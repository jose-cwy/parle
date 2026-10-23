function parseGraceUntil(env = process.env) {
  const raw = String(env.PARLE_AUTH_GRACE_UNTIL || '').trim()
  if (!raw) {
    return { configured: false, active: true }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { configured: false, active: true }
  }
  const end = Date.parse(`${raw}T23:59:59.999Z`)
  if (!Number.isFinite(end)) {
    return { configured: false, active: true }
  }
  return { configured: true, active: Date.now() <= end }
}

function isAuthGraceActive(env = process.env, now = Date.now()) {
  const parsed = parseGraceUntil(env)
  if (!parsed.configured) return true
  const raw = String(env.PARLE_AUTH_GRACE_UNTIL || '').trim()
  const end = Date.parse(`${raw}T23:59:59.999Z`)
  return now <= end
}

function adminRequireVerifiedEmail(env = process.env) {
  const raw = String(env.PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL || '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function isEmailVerified(user) {
  return Boolean(user && user.email_verified_at)
}

function sessionAllowsApp(user, env = process.env, now = Date.now()) {
  if (!user) return false
  if (isEmailVerified(user)) return true
  return isAuthGraceActive(env, now)
}

function mustVerifyToUseApp(user, env = process.env, now = Date.now()) {
  if (!user) return false
  if (isEmailVerified(user)) return false
  return !isAuthGraceActive(env, now)
}

function isGoogleSignInPublic(env = process.env) {
  const raw = String(env.NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN || '').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}

async function rejectUnverifiedAppSession(res, payload, env = process.env) {
  if (!payload?.id) return false
  if (isAuthGraceActive(env)) return false
  const db = require('../db')
  try {
    const result = await db.query(
      'SELECT id, email_verified_at FROM users WHERE id = $1 LIMIT 1',
      [payload.id],
    )
    const row = result.rows[0]
    if (!row) {
      res.status(401).json({ error: 'Unauthorized' })
      return true
    }
    if (!mustVerifyToUseApp(row, env)) return false
    res.status(403).json({ error: 'pending_verification', pending: true })
    return true
  } catch (error) {
    if (error?.code === '42703') return false
    throw error
  }
}

function googleEmailTrusted(claims = {}) {
  if (claims.email_verified !== true && claims.email_verified !== 'true') return false
  const email = String(claims.email || '').trim().toLowerCase()
  const domain = email.split('@')[1] || ''
  if (domain === 'gmail.com' || domain === 'googlemail.com') return true
  return Boolean(claims.hd)
}

module.exports = {
  parseGraceUntil,
  isAuthGraceActive,
  adminRequireVerifiedEmail,
  isEmailVerified,
  sessionAllowsApp,
  mustVerifyToUseApp,
  googleEmailTrusted,
  isGoogleSignInPublic,
  rejectUnverifiedAppSession,
}
