const db = require('../db')
const { runApiPipeline, handleApiError } = require('../security/pipeline')
const bcrypt = require('bcryptjs')
const {
  signToken,
  setSessionCookie,
  clearPendingVerifyCookie,
  getPendingVerifyFromReq,
  getSessionPayload,
} = require('../auth')
const { consumeChallenge, findUserByEmail, latestOpenChallenge, normalizeEmail } = require('../parle/authChallenges')
const { resendVerification, sendOrRefreshVerification } = require('../parle/sendVerifyMail')
const { withAdminFlag } = require('../parle/adminAuth')

async function markEmailVerified(userId) {
  const result = await db.query(
    `UPDATE users
     SET email_verified_at = COALESCE(email_verified_at, now()),
         updated_at = now()
     WHERE id = $1
     RETURNING id, email, preferred_name, accepted_terms_at, accepted_terms_version, created_at, email_verified_at`,
    [userId],
  )
  return result.rows[0] || null
}

async function applyChangedEmail(userId, email) {
  const result = await db.query(
    `UPDATE users
     SET email = $2,
         email_verified_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING id, email, preferred_name, accepted_terms_at, accepted_terms_version, created_at, email_verified_at`,
    [userId, email],
  )
  return result.rows[0] || null
}

async function emailChangeWasSuperseded(userId, challenge) {
  const result = await db.query(
    `SELECT 1
     FROM auth_challenges
     WHERE user_id = $1
       AND purpose = 'email_change'
       AND consumed_at IS NOT NULL
       AND id <> $2
       AND consumed_at > $3
     LIMIT 1`,
    [userId, challenge.id, challenge.created_at || new Date(0)],
  )
  return result.rows.length > 0
}

async function invalidateOtherEmailChangeChallenges(userId, keepId) {
  await db.query(
    `UPDATE auth_challenges
     SET consumed_at = COALESCE(consumed_at, now())
     WHERE user_id = $1
       AND purpose = 'email_change'
       AND id <> $2`,
    [userId, keepId],
  )
}

async function handleVerifyEmail(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const guard = await runApiPipeline(req, res, { tier: 'authStrict' })
  if (guard.handled) return

  const token = String(req.body?.token || '').trim()
  if (!token) {
    return res.status(400).json({ error: 'invalid', reason: 'invalid' })
  }

  try {
    const consumed = await consumeChallenge(token)
    if (!consumed.ok) {
      return res.status(400).json({ error: consumed.reason, reason: consumed.reason })
    }
    let user
    if (consumed.challenge.purpose === 'email_change') {
      if (await emailChangeWasSuperseded(consumed.challenge.user_id, consumed.challenge)) {
        return res.status(409).json({ error: 'stale', reason: 'invalid' })
      }
      const taken = await findUserByEmail(consumed.challenge.email)
      if (taken && taken.id !== consumed.challenge.user_id) {
        return res.status(409).json({ error: 'taken', reason: 'invalid' })
      }
      user = await applyChangedEmail(consumed.challenge.user_id, consumed.challenge.email)
      if (user) {
        await invalidateOtherEmailChangeChallenges(consumed.challenge.user_id, consumed.challenge.id)
      }
    } else {
      user = await markEmailVerified(consumed.challenge.user_id)
    }
    if (!user) {
      return res.status(400).json({ error: 'invalid', reason: 'invalid' })
    }
    const session = signToken({ id: user.id, email: user.email })
    setSessionCookie(res, session)
    clearPendingVerifyCookie(res)
    return res.status(200).json({ ok: true, user: withAdminFlag(user) })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production' && String(process.env.AUTH_TEST_MAIL || '') === '1') {
      console.error('verify_email_error', error)
      return res.status(500).json({ error: 'Something went wrong', hint: error.message })
    }
    return handleApiError(res, error, 'verify_email')
  }
}

async function handleResendVerification(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const guard = await runApiPipeline(req, res, { tier: 'authStrict' })
  if (guard.handled) return

  try {
    const session = getSessionPayload(req)
    const pending = getPendingVerifyFromReq(req)
    let user = null
    if (session?.id) {
      const result = await db.query(
        `SELECT id, email, email_verified_at FROM users WHERE id = $1 LIMIT 1`,
        [session.id],
      )
      user = result.rows[0] || null
    } else {
      const email = normalizeEmail(req.body?.email) || pending?.email
      if (!email) {
        return res.status(200).json({ ok: true })
      }
      user = await findUserByEmail(email)
    }
    if (!user || user.email_verified_at) {
      return res.status(200).json({ ok: true })
    }
    const signupOpen = await latestOpenChallenge(user.email, 'signup')
    const result = await resendVerification({
      userId: user.id,
      email: user.email,
      purpose: signupOpen ? 'signup' : 'existing_verify',
    })
    if (result.throttled) {
      return res.status(429).json({
        error: 'too_many_attempts',
        retryAfterMs: result.retryAfterMs,
      })
    }
    if (!result.delivered) {
      return res.status(503).json({ error: 'delivery_failed' })
    }
    return res.status(200).json({ ok: true })
  } catch (error) {
    return handleApiError(res, error, 'verify_resend')
  }
}

async function handleVerifyStatus(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const guard = await runApiPipeline(req, res)
  if (guard.handled) return
  const pending = getPendingVerifyFromReq(req)
  const email = pending?.email || null
  return res.status(200).json({
    pending: Boolean(email),
    email,
  })
}

async function handleEmailChangeRequest(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const guard = await runApiPipeline(req, res, { tier: 'authStrict' })
  if (guard.handled) return

  const session = getSessionPayload(req)
  const pending = getPendingVerifyFromReq(req)
  const userId = session?.id || pending?.id
  if (!userId) {
    return res.status(401).json({ error: 'Sign in first, then we can move this space to a new email.' })
  }

  const password = req.body?.password
  const nextEmail = normalizeEmail(req.body?.email)
  if (!nextEmail || typeof password !== 'string') {
    return res.status(400).json({ error: 'Enter your current password and a new email.' })
  }

  try {
    const result = await db.query(
      `SELECT id, email, password FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    )
    const user = result.rows[0]
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid' })
    }
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'That password did not match.' })
    if (normalizeEmail(user.email) === nextEmail) {
      return res.status(400).json({ error: 'Choose a different email than the one already on this space.' })
    }
    const taken = await findUserByEmail(nextEmail)
    if (taken) {
      return res.status(409).json({ error: 'That email already has a parlé space.' })
    }
    const mail = await sendOrRefreshVerification({
      userId: user.id,
      email: nextEmail,
      purpose: 'email_change',
    })
    if (mail.throttled) {
      return res.status(429).json({ error: 'too_many_attempts', retryAfterMs: mail.retryAfterMs })
    }
    if (!mail.delivered) {
      return res.status(503).json({ error: 'delivery_failed' })
    }
    return res.status(200).json({ ok: true, pending: true, delivered: true })
  } catch (error) {
    return handleApiError(res, error, 'verify_email_change')
  }
}

module.exports = {
  handleVerifyEmail,
  handleResendVerification,
  handleVerifyStatus,
  handleEmailChangeRequest,
  markEmailVerified,
}
