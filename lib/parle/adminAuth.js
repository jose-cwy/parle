const db = require('../db')
const { isAdminEmail } = require('./metricsExclude')

async function requireAdminUser(payload, env = process.env) {
  const userId = payload?.id
  if (!userId) return { ok: false, status: 404 }
  try {
    const result = await db.query('SELECT id, email FROM users WHERE id = $1 LIMIT 1', [userId])
    const row = result.rows[0]
    if (!row || !isAdminEmail(row.email, env)) {
      return { ok: false, status: 404 }
    }
    return { ok: true, user: { id: row.id, email: row.email } }
  } catch (error) {
    console.error('admin_auth_error', { code: error?.code || 'unknown' })
    return { ok: false, status: 404 }
  }
}

module.exports = {
  requireAdminUser,
}
