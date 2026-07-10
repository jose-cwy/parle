const db = require('../db')

let schemaReady = null

function isValidEmailFormat(email) {
  const value = String(email || '').trim().toLowerCase()
  if (!value || value.length > 320) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function ensureGuestEmailsSchema() {
  if (!schemaReady) {
    schemaReady = db
      .query(`
        CREATE TABLE IF NOT EXISTS guest_emails (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(320) NOT NULL,
          reason VARCHAR(32),
          session_message_count INTEGER,
          source VARCHAR(32) NOT NULL DEFAULT 'guest_chat',
          followup_due_at TIMESTAMPTZ,
          followup_sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS guest_emails_email_lower_idx
          ON guest_emails (LOWER(email));
        CREATE INDEX IF NOT EXISTS guest_emails_followup_due_idx
          ON guest_emails (followup_due_at)
          WHERE followup_sent_at IS NULL;
      `)
      .catch(() => {})
  }
  return schemaReady
}

async function saveGuestEmailCapture({
  email,
  reason = null,
  sessionMessageCount = null,
  source = 'guest_chat',
}) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!isValidEmailFormat(normalized)) {
    return { ok: false, status: 400, error: 'Invalid email' }
  }

  await ensureGuestEmailsSchema()

  const existing = await db.query(
    'SELECT id FROM guest_emails WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [normalized],
  )
  if (existing.rows.length > 0) {
    return { ok: true, duplicate: true }
  }

  const followupDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

  await db.query(
    `INSERT INTO guest_emails (
      email,
      reason,
      session_message_count,
      source,
      followup_due_at
    ) VALUES ($1, $2, $3, $4, $5)`,
    [
      normalized,
      reason || null,
      Number.isFinite(sessionMessageCount) ? sessionMessageCount : null,
      source,
      followupDueAt,
    ],
  )

  return { ok: true, duplicate: false }
}

async function listDueGuestFollowups(limit = 50) {
  await ensureGuestEmailsSchema()
  const result = await db.query(
    `SELECT id, email
     FROM guest_emails
     WHERE followup_sent_at IS NULL
       AND followup_due_at IS NOT NULL
       AND followup_due_at <= now()
     ORDER BY followup_due_at ASC
     LIMIT $1`,
    [limit],
  )
  return result.rows
}

async function markGuestFollowupSent(id) {
  await ensureGuestEmailsSchema()
  await db.query(
    `UPDATE guest_emails
     SET followup_sent_at = now()
     WHERE id = $1 AND followup_sent_at IS NULL`,
    [id],
  )
}

module.exports = {
  isValidEmailFormat,
  ensureGuestEmailsSchema,
  saveGuestEmailCapture,
  listDueGuestFollowups,
  markGuestFollowupSent,
}
