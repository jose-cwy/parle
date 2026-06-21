const db = require('../db')

const DEFAULT_USER_SETTINGS = {
  memory_enabled: true,
  personalisation_enabled: true,
}

const SETTINGS_FIELDS = ['memory_enabled', 'personalisation_enabled']

function normalizeSettings(row = {}) {
  return {
    memory_enabled: Boolean(row.memory_enabled),
    personalisation_enabled: Boolean(row.personalisation_enabled),
    preferred_name: row.preferred_name != null ? String(row.preferred_name) : '',
  }
}

async function ensureUserSettingsDefaults(userId) {
  await db.query(
    `UPDATE users SET
      memory_enabled = COALESCE(memory_enabled, TRUE),
      personalisation_enabled = COALESCE(personalisation_enabled, TRUE)
     WHERE id = $1`,
    [userId],
  )
}

async function getUserSettings(userId) {
  try {
    await ensureUserSettingsDefaults(userId)
    const result = await db.query(
      `SELECT memory_enabled, personalisation_enabled, preferred_name
       FROM users WHERE id = $1`,
      [userId],
    )
    if (!result.rows.length) return { ...DEFAULT_USER_SETTINGS }
    return normalizeSettings(result.rows[0])
  } catch (error) {
    if (error?.code === '42703') {
      const migrationError = new Error('Database migration required')
      migrationError.code = '42703'
      throw migrationError
    }
    throw error
  }
}

function pickValidSettingsPatch(body) {
  const patch = {}
  for (const field of SETTINGS_FIELDS) {
    if (body[field] === undefined) continue
    if (typeof body[field] !== 'boolean') {
      return { error: `Invalid value for ${field}` }
    }
    patch[field] = body[field]
  }
  if (!Object.keys(patch).length) {
    return { error: 'No valid fields to update' }
  }
  return { patch }
}

async function updateUserSettings(userId, body) {
  const { patch, error } = pickValidSettingsPatch(body || {})
  if (error) {
    const validationError = new Error(error)
    validationError.statusCode = 400
    throw validationError
  }

  const updates = []
  const values = []
  let index = 1

  for (const [field, value] of Object.entries(patch)) {
    updates.push(`${field} = $${index++}`)
    values.push(value)
  }

  values.push(userId)

  try {
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${index}`,
      values,
    )
  } catch (dbError) {
    if (dbError?.code === '42703') {
      const migrationError = new Error('Database migration required')
      migrationError.code = '42703'
      migrationError.statusCode = 503
      throw migrationError
    }
    throw dbError
  }

  return getUserSettings(userId)
}

module.exports = {
  DEFAULT_USER_SETTINGS,
  SETTINGS_FIELDS,
  getUserSettings,
  updateUserSettings,
  ensureUserSettingsDefaults,
  normalizeSettings,
}
