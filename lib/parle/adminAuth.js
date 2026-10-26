const db = require('../db')
const { isAdminEmail } = require('./metricsExclude')
const { adminRequireVerifiedEmail } = require('./authAccess')

function withAdminFlag(user, env = process.env) {
  if (!user || typeof user !== 'object') return user
  return {
    ...user,
    isAdmin: isAdminEmail(user.email, env),
  }
}

async function requireAdminUser(payload, env = process.env) {
  const userId = payload?.id
  if (!userId) return { ok: false, status: 404 }
  try {
    const result = await db.query(
      'SELECT id, email, email_verified_at FROM users WHERE id = $1 LIMIT 1',
      [userId],
    )
    const row = result.rows[0]
    if (!row || !isAdminEmail(row.email, env)) {
      return { ok: false, status: 404 }
    }
    if (adminRequireVerifiedEmail(env) && !row.email_verified_at) {
      return { ok: false, status: 404, reason: 'unverified' }
    }
    return { ok: true, user: { id: row.id, email: row.email } }
  } catch (error) {
    const { isAuthSchemaError, adminDenyForSchemaError } = require('./authSchemaFallback')
    if (isAuthSchemaError(error)) {
      console.error('admin_auth_schema_error', { code: error?.code || 'unknown' })
      return adminDenyForSchemaError()
    }
    console.error('admin_auth_error', { code: error?.code || 'unknown' })
    return { ok: false, status: 404 }
  }
}

module.exports = {
  withAdminFlag,
  requireAdminUser,
}
