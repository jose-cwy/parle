const db = require('../db')

let schemaReady = null

async function ensureFeedbackSchema() {
  if (!schemaReady) {
    schemaReady = db
      .query(`
        CREATE TABLE IF NOT EXISTS message_feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          session_id VARCHAR(128),
          message_id VARCHAR(128),
          rating VARCHAR(16) NOT NULL,
          reason VARCHAR(64),
          mode_id VARCHAR(64),
          reply_excerpt TEXT,
          user_excerpt TEXT,
          is_guest BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        ALTER TABLE message_feedback ADD COLUMN IF NOT EXISTS reason VARCHAR(64);
        ALTER TABLE message_feedback ADD COLUMN IF NOT EXISTS reply_excerpt TEXT;
        ALTER TABLE message_feedback ADD COLUMN IF NOT EXISTS user_excerpt TEXT;

        CREATE INDEX IF NOT EXISTS idx_message_feedback_created
          ON message_feedback (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_message_feedback_user
          ON message_feedback (user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_message_feedback_session
          ON message_feedback (session_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS product_feedback (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          session_id VARCHAR(128),
          variant VARCHAR(8),
          response VARCHAR(64) NOT NULL,
          note TEXT,
          message_count INTEGER,
          is_guest BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_product_feedback_created
          ON product_feedback (created_at DESC);
      `)
      .catch((error) => {
        console.error('feedback_schema_error', error)
      })
  }
  return schemaReady
}

function truncate(value, max) {
  const text = String(value || '').trim()
  if (!text) return null
  return text.slice(0, max)
}

async function insertMessageFeedback({
  userId,
  sessionId,
  messageId,
  rating,
  reason,
  modeId,
  replyExcerpt,
  userExcerpt,
  isGuest,
}) {
  await ensureFeedbackSchema()
  await db.query(
    `INSERT INTO message_feedback
      (user_id, session_id, message_id, rating, reason, mode_id, reply_excerpt, user_excerpt, is_guest)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      userId || null,
      String(sessionId || '').slice(0, 128) || null,
      String(messageId || '').slice(0, 128) || null,
      String(rating || '').slice(0, 16),
      reason ? String(reason).slice(0, 64) : null,
      modeId ? String(modeId).slice(0, 64) : null,
      truncate(replyExcerpt, 400),
      truncate(userExcerpt, 200),
      Boolean(isGuest),
    ],
  )
}

async function getRecentReplyFeedback({ userId, sessionId, limit = 6 }) {
  await ensureFeedbackSchema()
  const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 12)

  try {
    if (userId) {
      const result = await db.query(
        `SELECT rating, reason, reply_excerpt, user_excerpt, mode_id, created_at
         FROM message_feedback
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, safeLimit],
      )
      return result.rows || []
    }

    const token = String(sessionId || '').trim().slice(0, 128)
    if (!token) return []

    const result = await db.query(
      `SELECT rating, reason, reply_excerpt, user_excerpt, mode_id, created_at
       FROM message_feedback
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [token, safeLimit],
    )
    return result.rows || []
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703') return []
    console.error('get_recent_reply_feedback_error', error)
    return []
  }
}

async function insertProductFeedback({
  userId,
  sessionId,
  variant,
  response,
  note,
  messageCount,
  isGuest,
}) {
  await ensureFeedbackSchema()
  await db.query(
    `INSERT INTO product_feedback
      (user_id, session_id, variant, response, note, message_count, is_guest)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId || null,
      String(sessionId || '').slice(0, 128) || null,
      variant ? String(variant).slice(0, 8) : null,
      String(response || '').slice(0, 64),
      note != null && String(note).trim() ? String(note).slice(0, 1000) : null,
      Number.isFinite(Number(messageCount)) ? Number(messageCount) : null,
      Boolean(isGuest),
    ],
  )
}

module.exports = {
  ensureFeedbackSchema,
  insertMessageFeedback,
  getRecentReplyFeedback,
  insertProductFeedback,
}
