const db = require('../db')
const { runApiPipeline, handleApiError } = require('../security/pipeline')
const {
  signToken,
  setSessionCookie,
  clearPendingVerifyCookie,
  getPendingVerifyFromReq,
} = require('../auth')
const { consumeChallenge, findUserByEmail, normalizeEmail } = require('../parle/authChallenges')
const { resendVerification } = require('../parle/sendVerifyMail')
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

async function handleVerifyEmail(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const guard = runApiPipeline(req, res, { tier: 'authStrict' })
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
    const user = await markEmailVerified(consumed.challenge.user_id)
    if (!user) {
      return res.status(400).json({ error: 'invalid', reason: 'invalid' })
    }
    const session = signToken({ id: user.id, email: user.email })
    setSessionCookie(res, session)
    clearPendingVerifyCookie(res)
    return res.status(200).json({ ok: true, user: withAdminFlag(user) })
  } catch (error) {
    return handleApiError(res, error, 'verify_email')
  }
}

async function handleResendVerification(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const guard = runApiPipeline(req, res, { tier: 'authStrict' })
  if (guard.handled) return

  try {
    const pending = getPendingVerifyFromReq(req)
    const email = normalizeEmail(req.body?.email) || pending?.email
    if (!email) {
      return res.status(200).json({ ok: true })
    }
    const user = await findUserByEmail(email)
    if (!user || user.email_verified_at) {
      return res.status(200).json({ ok: true })
    }
    const result = await resendVerification({
      userId: user.id,
      email: user.email,
      purpose: 'existing_verify',
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

module.exports = {
  handleVerifyEmail,
  handleResendVerification,
  markEmailVerified,
}
