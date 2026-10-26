const DEFAULT_NEW_SIGNUP_FROM = '2026-10-23'

function parseDayEndUtc(raw) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw || ''))) return null
  const end = Date.parse(`${raw}T23:59:59.999Z`)
  return Number.isFinite(end) ? end : null
}

function parseDayStartUtc(raw) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw || ''))) return null
  const start = Date.parse(`${raw}T00:00:00.000Z`)
  return Number.isFinite(start) ? start : null
}

function parseGraceUntil(env = process.env) {
  const raw = String(env.PARLE_AUTH_GRACE_UNTIL || '').trim()
  if (!raw) {
    return { configured: false, active: true }
  }
  const end = parseDayEndUtc(raw)
  if (end == null) {
    return { configured: false, active: true }
  }
  return { configured: true, active: Date.now() <= end }
}

function isAuthGraceActive(env = process.env, now = Date.now()) {
  const parsed = parseGraceUntil(env)
  if (!parsed.configured) return true
  const raw = String(env.PARLE_AUTH_GRACE_UNTIL || '').trim()
  const end = parseDayEndUtc(raw)
  return end != null && now <= end
}

function parseNewSignupFrom(env = process.env) {
  const raw = String(env.PARLE_AUTH_NEW_SIGNUP_FROM || '').trim()
  if (!raw) return parseDayStartUtc(DEFAULT_NEW_SIGNUP_FROM)
  return parseDayStartUtc(raw) ?? parseDayStartUtc(DEFAULT_NEW_SIGNUP_FROM)
}

function isRequiredFlagFalse(value) {
  return value === false || value === 'f' || value === 'false' || value === 0
}

function isLegacyUnverified(user, env = process.env) {
  if (!user || isEmailVerified(user)) return false
  if (isRequiredFlagFalse(user.email_verification_required)) return true
  const cutoff = parseNewSignupFrom(env)
  if (cutoff == null) return false
  const created = Date.parse(user.created_at)
  if (!Number.isFinite(created)) return true
  return created < cutoff
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
  if (!isAuthGraceActive(env, now)) return false
  return isLegacyUnverified(user, env)
}

function mustVerifyToUseApp(user, env = process.env, now = Date.now()) {
  if (!user) return false
  if (isEmailVerified(user)) return false
  return !sessionAllowsApp(user, env, now)
}

function isGoogleSignInPublic(env = process.env) {
  const raw = String(env.NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN || '').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}

async function rejectUnverifiedAppSession(res, payload, env = process.env) {
  if (!payload?.id) return false
  const db = require('../db')
  try {
    const result = await db.query(
      `SELECT id, email_verified_at, email_verification_required, created_at
       FROM users WHERE id = $1 LIMIT 1`,
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
    const { isAuthSchemaError, apiRejectForSchemaError } = require('./authSchemaFallback')
    if (isAuthSchemaError(error)) {
      const decision = apiRejectForSchemaError()
      res.status(decision.status).json(decision.body)
      return true
    }
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
  DEFAULT_NEW_SIGNUP_FROM,
  parseGraceUntil,
  isAuthGraceActive,
  parseNewSignupFrom,
  isLegacyUnverified,
  adminRequireVerifiedEmail,
  isEmailVerified,
  sessionAllowsApp,
  mustVerifyToUseApp,
  googleEmailTrusted,
  isGoogleSignInPublic,
  rejectUnverifiedAppSession,
}
