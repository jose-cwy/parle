const crypto = require('crypto')
const db = require('../db')
const { runApiPipeline, handleApiError } = require('../security/pipeline')
const {
  TERMS_VERSION,
  signToken,
  setSessionCookie,
  getTermsAcceptanceFromReq,
  clearTermsAcceptanceCookie,
  setOauthCookie,
  getOauthFromReq,
  clearOauthCookie,
  setGooglePendingCookie,
  getGooglePendingFromReq,
  clearGooglePendingCookie,
} = require('../auth')
const {
  googleAuthUrl,
  pkceVerifier,
  pkceChallenge,
  exchangeCode,
  verifyIdToken,
  isGoogleTestMode,
} = require('../parle/googleAuth')
const { googleEmailTrusted, isGoogleSignInPublic } = require('../parle/authAccess')
const { normalizeEmail, findUserByEmail } = require('../parle/authChallenges')
const { withAdminFlag } = require('../parle/adminAuth')
const { safeNextPath } = require('../routes')

function randomState() {
  return crypto.randomBytes(24).toString('base64url')
}

function sessionFor(res, user) {
  const token = signToken({ id: user.id, email: user.email })
  setSessionCookie(res, token)
  clearOauthCookie(res)
  clearGooglePendingCookie(res)
}

async function findIdentity(provider, subject) {
  const result = await db.query(
    `SELECT user_id FROM user_auth_identities WHERE provider = $1 AND provider_subject = $2 LIMIT 1`,
    [provider, subject],
  )
  return result.rows[0] || null
}

async function loadUser(id) {
  const result = await db.query(
    `SELECT id, email, preferred_name, accepted_terms_at, accepted_terms_version, created_at, email_verified_at
     FROM users WHERE id = $1 LIMIT 1`,
    [id],
  )
  return result.rows[0] || null
}

async function insertGoogleUser({ email, emailVerifiedAt, termsAt }) {
  const now = new Date()
  const result = await db.query(
    `INSERT INTO users (
       email, password, accepted_terms_at, accepted_terms_version,
       memory_enabled, personalisation_enabled, created_at, updated_at,
       email_verified_at, email_verification_required
     )
     VALUES ($1, NULL, $2, $3, TRUE, TRUE, $4, $5, $6, TRUE)
     RETURNING id, email, preferred_name, accepted_terms_at, accepted_terms_version, created_at, email_verified_at`,
    [email, termsAt, TERMS_VERSION, now, now, emailVerifiedAt],
  )
  return result.rows[0]
}

async function insertIdentity({ userId, subject, email }) {
  await db.query(
    `INSERT INTO user_auth_identities (user_id, provider, provider_subject, email_at_link)
     VALUES ($1, 'google', $2, $3)`,
    [userId, subject, email],
  )
}

async function handleGoogleStart(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const guard = await runApiPipeline(req, res, { tier: 'authStrict' })
  if (guard.handled) return

  if (!isGoogleSignInPublic() && !isGoogleTestMode()) {
    return res.status(503).json({ error: 'Google sign-in is not enabled.' })
  }
  if (!process.env.GOOGLE_CLIENT_ID && !isGoogleTestMode()) {
    return res.status(503).json({ error: 'Google sign-in is not configured.' })
  }

  const state = randomState()
  const nonce = randomState()
  const verifier = pkceVerifier()
  const returnTo = safeNextPath(req.query.next, '/dashboard')
  setOauthCookie(res, { state, nonce, verifier, returnTo })

  const url = googleAuthUrl({
    state,
    nonce,
    codeChallenge: pkceChallenge(verifier),
  })
  return res.redirect(302, url)
}

function claimsEmail(claims) {
  return normalizeEmail(claims.email)
}

function oauthStateMatches(expected, actual) {
  const left = Buffer.from(String(expected || ''), 'utf8')
  const right = Buffer.from(String(actual || ''), 'utf8')
  if (!left.length || left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function googleAccountDecision({
  subject,
  email,
  identityUserId,
  emailOwnerId,
  existingSessionId,
  current,
}) {
  if (!subject || !email) return { action: 'error', redirect: '/login?auth=google_error' }
  if (identityUserId) {
    if (existingSessionId && existingSessionId !== identityUserId) {
      return { action: 'error', redirect: '/login?auth=google_other_account' }
    }
    return { action: 'signin', userId: identityUserId }
  }
  if (existingSessionId) {
    if (!current) return { action: 'error', redirect: '/login?auth=google_error' }
    if (!current.email_verified_at) {
      return { action: 'error', redirect: '/verify-email/pending?auth=verify_before_link' }
    }
    if (normalizeEmail(current.email) !== email) {
      return { action: 'error', redirect: '/login?auth=google_email_mismatch' }
    }
    return { action: 'link', userId: existingSessionId }
  }
  if (emailOwnerId) return { action: 'collision', redirect: '/login?auth=link_required' }
  return { action: 'create' }
}

async function finishGoogleUser({ req, res, claims, existingSessionId }) {
  const subject = String(claims.sub || '')
  const email = claimsEmail(claims)
  const identity = subject ? await findIdentity('google', subject) : null
  const emailOwner = email ? await findUserByEmail(email) : null
  const current = existingSessionId ? await loadUser(existingSessionId) : null
  const decision = googleAccountDecision({
    subject,
    email,
    identityUserId: identity?.user_id || null,
    emailOwnerId: emailOwner?.id || null,
    existingSessionId,
    current,
  })

  if (decision.action === 'error' || decision.action === 'collision') {
    return { redirect: decision.redirect }
  }
  if (decision.action === 'signin') {
    const user = await loadUser(decision.userId)
    if (!user) return { redirect: '/login?auth=google_error' }
    sessionFor(res, user)
    return { user }
  }
  if (decision.action === 'link') {
    await insertIdentity({ userId: decision.userId, subject, email })
    sessionFor(res, current)
    return { user: current, linked: true }
  }

  const terms = getTermsAcceptanceFromReq(req)
  if (!terms) {
    setGooglePendingCookie(res, { sub: subject, email, email_verified: claims.email_verified, hd: claims.hd })
    return { redirect: '/register?google=pending' }
  }

  const trusted = googleEmailTrusted(claims)
  const user = await insertGoogleUser({
    email,
    emailVerifiedAt: trusted ? new Date() : null,
    termsAt: new Date(),
  })
  await insertIdentity({ userId: user.id, subject, email })
  try {
    const { recordProductEvent } = require('../../lib/parle/productEvents')
    await recordProductEvent({ name: 'account_created', userId: user.id, isGuest: false })
  } catch {
    /* ignore */
  }
  sessionFor(res, user)
  clearTermsAcceptanceCookie(res)
  return { user }
}

async function handleGoogleCallback(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const oauth = getOauthFromReq(req)
  const queryState = String(req.query.state || '')
  const error = String(req.query.error || '')
  if (error === 'access_denied') {
    clearOauthCookie(res)
    return res.redirect(302, '/login?auth=google_cancelled')
  }
  if (!oauth || !oauthStateMatches(oauth.state, queryState)) {
    clearOauthCookie(res)
    return res.redirect(302, '/login?auth=google_error')
  }

  try {
    const exchanged = await exchangeCode({
      code: req.query.code,
      codeVerifier: oauth.verifier,
    })
    const claims = exchanged.claims || (await verifyIdToken({
      idToken: exchanged.id_token,
      nonce: oauth.nonce,
    }))
    const result = await finishGoogleUser({
      req,
      res,
      claims,
      existingSessionId: getSessionPayloadSafe(req),
    })
    if (result.redirect) return res.redirect(302, result.redirect)
    const { hasPreferredName } = require('../user')
    const { postLoginPath } = require('../routes')
    const flagged = withAdminFlag(result.user)
    const dest = postLoginPath(flagged, oauth.returnTo)
    if (!hasPreferredName(result.user) && dest !== '/welcome') {
      return res.redirect(302, '/welcome')
    }
    return res.redirect(302, dest)
  } catch (error) {
    console.error('google_callback_error', { name: error?.name || 'error' })
    clearOauthCookie(res)
    return res.redirect(302, '/login?auth=google_error')
  }
}

function getSessionPayloadSafe(req) {
  try {
    const { getSessionPayload } = require('../auth')
    return getSessionPayload(req)?.id || null
  } catch {
    return null
  }
}

async function handleGoogleComplete(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const guard = await runApiPipeline(req, res, { tier: 'authStrict' })
  if (guard.handled) return
  const terms = getTermsAcceptanceFromReq(req)
  if (!terms) {
    return res.status(403).json({ error: 'Please review and accept the terms before continuing.' })
  }
  const pending = getGooglePendingFromReq(req)
  if (!pending?.sub || !pending.email) {
    return res.status(400).json({ error: 'google_pending_missing' })
  }
  try {
    const result = await finishGoogleUser({
      req,
      res,
      claims: {
        sub: pending.sub,
        email: pending.email,
        email_verified: pending.email_verified,
        hd: pending.hd,
      },
    })
    if (result.redirect) return res.status(409).json({ error: result.redirect })
    return res.status(200).json({ ok: true, user: withAdminFlag(result.user) })
  } catch (error) {
    return handleApiError(res, error, 'google_complete')
  }
}

module.exports = {
  handleGoogleStart,
  handleGoogleCallback,
  handleGoogleComplete,
  finishGoogleUser,
  googleAccountDecision,
  oauthStateMatches,
}
