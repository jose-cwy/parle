const bcrypt = require('bcryptjs')
const db = require('../db')
const { runApiPipeline, handleApiError } = require('../security/pipeline')
const {
  TERMS_VERSION,
  clearTermsAcceptanceCookie,
  getTermsAcceptanceFromReq,
  setPendingVerifyCookie,
} = require('../auth')
const { getRegisterConfigErrors, mapDatabaseError } = require('../serverConfig')
const { normalizeEmail, reclaimStaleUnverified, findUserByEmail } = require('../parle/authChallenges')
const { sendOrRefreshVerification } = require('../parle/sendVerifyMail')

let onboardingSchemaReady = null

async function ensureOnboardingSchema() {
  if (!onboardingSchemaReady) {
    onboardingSchemaReady = db
      .query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_reason VARCHAR(32);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_answered BOOLEAN NOT NULL DEFAULT FALSE;
      `)
      .catch(() => {})
  }
  return onboardingSchemaReady
}

function pendingResponse(res, extras = {}) {
  return res.status(201).json({ ok: true, pending: true, ...extras })
}

function validPassword(password) {
  if (typeof password !== 'string') return false
  if (password.length < 8 || password.length > 72) return false
  if (!password.trim()) return false
  return true
}

async function insertUnverifiedUser({ email, hash }) {
  const now = new Date()
  const result = await db.query(
    `INSERT INTO users (
       email, password, accepted_terms_at, accepted_terms_version,
       memory_enabled, personalisation_enabled, created_at, updated_at,
       email_verification_required
     )
     VALUES ($1,$2,$3,$4,TRUE,TRUE,$5,$6,TRUE)
     RETURNING id, email`,
    [email, hash, now, TERMS_VERSION, now, now],
  )
  return result.rows[0]
}

async function handleRegister(req, res) {
  const guard = runApiPipeline(req, res, { tier: 'authStrict' })
  if (guard.handled) return

  const configErrors = getRegisterConfigErrors()
  if (configErrors.length) {
    console.error('register_config_missing', configErrors.join(', '))
    return res.status(503).json({
      error: `Server configuration incomplete (missing: ${configErrors.join(', ')}).`,
    })
  }

  const { email: rawEmail, password } = req.body || {}
  const email = normalizeEmail(rawEmail)
  if (!email || !validPassword(password)) {
    return res.status(400).json({ error: 'Enter a valid email and a password of at least 8 characters.' })
  }

  const acceptedTerms = getTermsAcceptanceFromReq(req)
  if (!acceptedTerms) {
    return res.status(403).json({
      error: 'Please review and accept the terms before creating an account.',
    })
  }

  try {
    await ensureOnboardingSchema()
    const reclaim = await reclaimStaleUnverified(email)
    const existing = reclaim.reclaimed ? null : await findUserByEmail(email)

    if (existing?.email_verified_at) {
      return pendingResponse(res, { delivered: true })
    }

    if (existing && !reclaim.reclaimed) {
      const mail = await sendOrRefreshVerification({
        userId: existing.id,
        email,
        purpose: 'existing_verify',
      })
      clearTermsAcceptanceCookie(res)
      return pendingResponse(res, {
        delivered: mail.delivered === true,
        throttled: Boolean(mail.throttled),
      })
    }

    const hash = await bcrypt.hash(password, 12)
    const user = await insertUnverifiedUser({ email, hash })
    const mail = await sendOrRefreshVerification({
      userId: user.id,
      email,
      purpose: 'signup',
    })

    try {
      const { recordProductEvent } = require('../../lib/parle/productEvents')
      await recordProductEvent({
        name: 'account_created',
        userId: user.id,
        isGuest: false,
      })
    } catch {
      /* analytics must not fail signup */
    }

    setPendingVerifyCookie(res, { id: user.id, email: user.email })
    clearTermsAcceptanceCookie(res)
    return pendingResponse(res, {
      delivered: mail.delivered === true,
      throttled: Boolean(mail.throttled),
    })
  } catch (error) {
    if (error?.code === 'CONFIG_JWT_SECRET') {
      return res.status(503).json({ error: 'Signup is temporarily unavailable. JWT_SECRET is not configured.' })
    }
    if (error?.code === '23505') {
      return pendingResponse(res)
    }
    if (error?.code === '42703') {
      return res.status(503).json({ error: 'Email verification is not ready on this database yet.' })
    }

    const mapped = mapDatabaseError(error)
    if (mapped) {
      const status = error?.code === '23505' ? 201 : 503
      if (status === 201) return pendingResponse(res)
      console.error('register_db_error', error?.code, error?.message)
      return res.status(status).json({ error: mapped })
    }

    return handleApiError(res, error, 'register')
  }
}

module.exports = { handleRegister }
