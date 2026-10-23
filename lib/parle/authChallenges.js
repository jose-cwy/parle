const crypto = require('crypto')
const db = require('../db')
const { isValidEmailFormat } = require('./guestEmailsDb')

const TOKEN_BYTES = 32
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000
const STALE_UNVERIFIED_MS = 24 * 60 * 60 * 1000

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!isValidEmailFormat(email)) return null
  return email
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex')
}

function createRawToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url')
}

function timingSafeEqualHex(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8')
  const b = Buffer.from(String(right || ''), 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function classifyConsumeMiss(found, now = new Date()) {
  if (!found) return 'invalid'
  if (found.consumed_at) return 'used'
  if (new Date(found.expires_at).getTime() <= now.getTime()) return 'expired'
  return 'invalid'
}

function reclaimDecision(existing, ownedCount, now = new Date(), staleMs = STALE_UNVERIFIED_MS) {
  if (!existing) return { action: 'insert' }
  if (existing.email_verified_at) return { action: 'exists_verified' }
  const ageMs = now.getTime() - new Date(existing.created_at).getTime()
  if (ageMs < staleMs) return { action: 'pending' }
  if (Number(ownedCount) > 0) return { action: 'has_data' }
  return { action: 'reclaim' }
}

async function issueChallenge({ userId, email, purpose, ttlMs = DEFAULT_TTL_MS, now = new Date() }) {
  const canonical = normalizeEmail(email)
  if (!canonical) {
    const err = new Error('invalid_email')
    err.code = 'INVALID_EMAIL'
    throw err
  }
  const raw = createRawToken()
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(now.getTime() + ttlMs)
  const result = await db.query(
    `INSERT INTO auth_challenges (user_id, email, purpose, token_hash, expires_at, last_sent_at)
     VALUES ($1,$2,$3,$4,$5,NULL)
     RETURNING id`,
    [userId || null, canonical, purpose, tokenHash, expiresAt],
  )
  return { id: result.rows[0]?.id, raw, email: canonical, expiresAt }
}

async function latestOpenChallenge(email, purpose) {
  const canonical = normalizeEmail(email)
  if (!canonical) return null
  const result = await db.query(
    `SELECT id, user_id, email, purpose, last_sent_at, expires_at, consumed_at, created_at
     FROM auth_challenges
     WHERE email = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [canonical, purpose],
  )
  return result.rows[0] || null
}

async function canResend(email, purpose, now = new Date()) {
  const row = await latestOpenChallenge(email, purpose)
  if (!row || !row.last_sent_at) return { ok: true, retryAfterMs: 0 }
  const elapsed = now.getTime() - new Date(row.last_sent_at).getTime()
  if (elapsed >= RESEND_COOLDOWN_MS) return { ok: true, retryAfterMs: 0, challenge: row }
  return { ok: false, retryAfterMs: RESEND_COOLDOWN_MS - elapsed, challenge: row }
}

async function markChallengeSent(id, now = new Date()) {
  await db.query(`UPDATE auth_challenges SET last_sent_at = $2 WHERE id = $1`, [id, now])
}

async function consumeChallenge(rawToken, now = new Date()) {
  const tokenHash = hashToken(rawToken)
  const result = await db.query(
    `UPDATE auth_challenges
     SET consumed_at = $2
     WHERE token_hash = $1
       AND consumed_at IS NULL
       AND expires_at > $2
     RETURNING id, user_id, email, purpose, expires_at`,
    [tokenHash, now],
  )
  const row = result.rows[0]
  if (!row) {
    const existing = await db.query(
      `SELECT consumed_at, expires_at FROM auth_challenges WHERE token_hash = $1 LIMIT 1`,
      [tokenHash],
    )
    const found = existing.rows[0]
    return { ok: false, reason: classifyConsumeMiss(found, now) }
  }
  if (!timingSafeEqualHex(hashToken(rawToken), tokenHash)) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, challenge: row }
}

async function userOwnedDataCount(userId) {
  try {
    const result = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM chat_memory WHERE user_id = $1) +
         (SELECT COUNT(*)::int FROM diary WHERE user_id = $1) +
         COALESCE((SELECT COUNT(*)::int FROM user_auth_identities WHERE user_id = $1), 0)
       AS n`,
      [userId],
    )
    return Number(result.rows[0]?.n || 0)
  } catch (error) {
    if (error?.code !== '42P01' && error?.code !== '42703') throw error
    const result = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM chat_memory WHERE user_id = $1) +
         (SELECT COUNT(*)::int FROM diary WHERE user_id = $1)
       AS n`,
      [userId],
    )
    return Number(result.rows[0]?.n || 0)
  }
}

async function findUserByEmail(email) {
  const canonical = normalizeEmail(email)
  if (!canonical) return null
  const result = await db.query(
    `SELECT id, email, password, preferred_name, email_verified_at, email_verification_required, created_at
     FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [canonical],
  )
  return result.rows[0] || null
}

async function reclaimStaleUnverified(email, now = new Date()) {
  const existing = await findUserByEmail(email)
  const owned = existing ? await userOwnedDataCount(existing.id) : 0
  const decision = reclaimDecision(existing, owned, now)
  if (decision.action === 'insert') return { ok: true, reclaimed: false }
  if (decision.action !== 'reclaim') return { ok: false, reason: decision.action === 'exists_verified' ? 'verified' : decision.action }
  const cutoff = new Date(now.getTime() - STALE_UNVERIFIED_MS)
  const deleted = await db.query(
    `DELETE FROM users
     WHERE id = $1
       AND email_verified_at IS NULL
       AND created_at < $2
     RETURNING id`,
    [existing.id, cutoff],
  )
  if (!deleted.rows.length) return { ok: false, reason: 'pending' }
  return { ok: true, reclaimed: true }
}

module.exports = {
  TOKEN_BYTES,
  DEFAULT_TTL_MS,
  RESEND_COOLDOWN_MS,
  STALE_UNVERIFIED_MS,
  normalizeEmail,
  hashToken,
  createRawToken,
  issueChallenge,
  latestOpenChallenge,
  canResend,
  markChallengeSent,
  consumeChallenge,
  userOwnedDataCount,
  findUserByEmail,
  reclaimStaleUnverified,
  reclaimDecision,
  classifyConsumeMiss,
  timingSafeEqualHex,
}
