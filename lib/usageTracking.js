const crypto = require('crypto')
const db = require('./db')

const GUEST_DAILY_LIMIT = 30
const USER_DAILY_LIMIT = 100

let schemaReady = null

function hashIP(ip) {
  const salt = process.env.IP_HASH_SALT || process.env.JWT_SECRET || 'parle-dev-ip-salt'
  return crypto
    .createHash('sha256')
    .update(`${String(ip || 'unknown')}:${salt}`)
    .digest('hex')
    .slice(0, 16)
}

async function ensureUsageSchema() {
  if (!schemaReady) {
    schemaReady = db
      .query(`
        CREATE TABLE IF NOT EXISTS usage_tracking (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_identifier VARCHAR(64) NOT NULL,
          message_count INTEGER NOT NULL DEFAULT 0,
          usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
          is_guest BOOLEAN NOT NULL DEFAULT FALSE,
          UNIQUE (user_identifier, usage_date)
        )
      `)
      .catch(() => {})
  }
  return schemaReady
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

async function getOrCreateUsage(identifier, date, isGuest) {
  await ensureUsageSchema()
  const id = String(identifier).slice(0, 64)
  const result = await db.query(
    `INSERT INTO usage_tracking (user_identifier, usage_date, is_guest, message_count)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (user_identifier, usage_date)
     DO UPDATE SET user_identifier = EXCLUDED.user_identifier
     RETURNING message_count, is_guest`,
    [id, date, Boolean(isGuest)],
  )
  return result.rows[0] || { message_count: 0, is_guest: isGuest }
}

async function incrementUsage(identifier, date) {
  await ensureUsageSchema()
  const id = String(identifier).slice(0, 64)
  await db.query(
    `UPDATE usage_tracking
     SET message_count = message_count + 1
     WHERE user_identifier = $1 AND usage_date = $2`,
    [id, date],
  )
}

async function checkAndIncrementDailyUsage({ userId, ip, isGuest }) {
  const date = todayISO()
  const identifier = userId || hashIP(ip)
  const limit = isGuest ? GUEST_DAILY_LIMIT : USER_DAILY_LIMIT

  try {
    const usage = await getOrCreateUsage(identifier, date, isGuest)
    if ((usage.message_count || 0) >= limit) {
      return {
        allowed: false,
        limit,
        isGuest,
        message: isGuest
          ? "you've reached today's limit. create a free account for more messages."
          : "you've reached today's message limit. come back tomorrow.",
      }
    }
    await incrementUsage(identifier, date)
    return { allowed: true, limit, isGuest }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[usageTracking] unavailable, skipping daily cap:', error?.message)
    }
    return { allowed: true, skipped: true }
  }
}

module.exports = {
  GUEST_DAILY_LIMIT,
  USER_DAILY_LIMIT,
  hashIP,
  checkAndIncrementDailyUsage,
}
