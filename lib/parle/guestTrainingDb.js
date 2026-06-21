const crypto = require('crypto')
const db = require('../db')
const { encrypt } = require('../security/encryption')
const { getClientIp } = require('../security/rateLimit')
const { hashIP } = require('../usageTracking')
const { scrubPII } = require('./scrubPII')
const { getModeLabel } = require('./modes')

let schemaReady = null

async function ensureGuestTrainingSchema() {
  if (!schemaReady) {
    schemaReady = db
      .query(`
        CREATE TABLE IF NOT EXISTS anonymous_sessions (
          session_token VARCHAR(128) PRIMARY KEY,
          mode_used VARCHAR(64),
          message_count INTEGER NOT NULL DEFAULT 0,
          training_eligible BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS anonymous_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_token VARCHAR(128) NOT NULL REFERENCES anonymous_sessions(session_token) ON DELETE CASCADE,
          role VARCHAR(16) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        ALTER TABLE anonymous_sessions ADD COLUMN IF NOT EXISTS training_eligible BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE anonymous_messages ADD COLUMN IF NOT EXISTS mode_id VARCHAR(64);
        ALTER TABLE anonymous_messages ADD COLUMN IF NOT EXISTS training_eligible BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE anonymous_messages ADD COLUMN IF NOT EXISTS reply_kind VARCHAR(16) NOT NULL DEFAULT 'normal';
        ALTER TABLE anonymous_messages ADD COLUMN IF NOT EXISTS training_content TEXT;

        CREATE INDEX IF NOT EXISTS idx_anonymous_messages_session ON anonymous_messages(session_token);
        CREATE INDEX IF NOT EXISTS idx_anonymous_messages_training
          ON anonymous_messages(training_eligible, created_at DESC)
          WHERE training_eligible = TRUE;
      `)
      .catch(() => {})
  }
  return schemaReady
}

function resolveGuestSessionToken(req, clientToken) {
  const trimmed = String(clientToken || '').trim().slice(0, 128)
  if (trimmed) return trimmed

  const ip = getClientIp(req)
  const ua = String(req.headers['user-agent'] || 'unknown').slice(0, 120)
  const digest = crypto
    .createHash('sha256')
    .update(`${hashIP(ip)}:${ua}`)
    .digest('hex')
    .slice(0, 32)
  return `guest-${digest}`
}

function buildTrainingPayload(text) {
  const scrubbed = scrubPII(String(text || ''))
  if (!scrubbed.trim()) return null

  const encrypted = encrypt(scrubbed)
  return { encryptedContent: encrypted, trainingContent: encrypted }
}

async function ensureGuestSession(sessionToken, modeId) {
  const token = String(sessionToken || '').trim()
  if (!token || token.length > 128) return false

  const modeUsed = getModeLabel(modeId) || String(modeId || 'cross')

  await db.query(
    `INSERT INTO anonymous_sessions (session_token, mode_used, message_count, training_eligible)
     VALUES ($1, $2, 0, TRUE)
     ON CONFLICT (session_token) DO UPDATE SET
       mode_used = COALESCE(EXCLUDED.mode_used, anonymous_sessions.mode_used),
       training_eligible = TRUE`,
    [token, modeUsed],
  )
  return true
}

async function logGuestTrainingMessage({
  sessionToken,
  role,
  text,
  modeId,
  replyKind = 'normal',
}) {
  const token = String(sessionToken || '').trim()
  if (!token || token.length > 128) return false

  const safeRole = role === 'assistant' ? 'assistant' : 'user'
  const payload = buildTrainingPayload(text)
  if (!payload) return false

  const { encryptedContent, trainingContent } = payload

  const safeModeId = String(modeId || 'cross').slice(0, 64)
  const safeReplyKind = String(replyKind || 'normal').slice(0, 16)

  try {
    await ensureGuestTrainingSchema()
    await ensureGuestSession(token, safeModeId)
    await db.query(
      `INSERT INTO anonymous_messages
        (session_token, role, content, mode_id, training_eligible, reply_kind, training_content)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6)`,
      [token, safeRole, encryptedContent, safeModeId, safeReplyKind, trainingContent],
    )
    await db.query(
      `UPDATE anonymous_sessions
       SET message_count = message_count + 1,
           mode_used = COALESCE($2, mode_used),
           training_eligible = TRUE
       WHERE session_token = $1`,
      [token, getModeLabel(safeModeId) || null],
    )
    return true
  } catch (error) {
    if (error?.code === '42P01') return false
    console.error('guest_training_log_error', error)
    return false
  }
}

async function logGuestTrainingExchange({
  sessionToken,
  modeId,
  userText,
  assistantText,
  replyKind = 'normal',
}) {
  if (!sessionToken) return false

  await logGuestTrainingMessage({
    sessionToken,
    role: 'user',
    text: userText,
    modeId,
    replyKind,
  })

  if (assistantText) {
    await logGuestTrainingMessage({
      sessionToken,
      role: 'assistant',
      text: assistantText,
      modeId,
      replyKind,
    })
  }

  return true
}

module.exports = {
  ensureGuestTrainingSchema,
  resolveGuestSessionToken,
  logGuestTrainingMessage,
  logGuestTrainingExchange,
}
