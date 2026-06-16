const db = require('../db')
const { scrubPII } = require('./scrubPII')
const { getModeLabel } = require('./modes')

async function ensureAnonymousSession(sessionToken, modeId) {
  const token = String(sessionToken || '').trim()
  if (!token || token.length > 128) return false

  const modeUsed = getModeLabel(modeId) || String(modeId || 'cross')

  await db.query(
    `INSERT INTO anonymous_sessions (session_token, mode_used, message_count)
     VALUES ($1, $2, 0)
     ON CONFLICT (session_token) DO UPDATE SET
       mode_used = COALESCE(EXCLUDED.mode_used, anonymous_sessions.mode_used)`,
    [token, modeUsed],
  )
  return true
}

async function logAnonymousMessage(sessionToken, role, content, modeId) {
  const token = String(sessionToken || '').trim()
  if (!token || token.length > 128) return

  const safeRole = role === 'assistant' ? 'assistant' : 'user'
  const scrubbed = scrubPII(content)

  try {
    await ensureAnonymousSession(token, modeId)
    await db.query(
      `INSERT INTO anonymous_messages (session_token, role, content)
       VALUES ($1, $2, $3)`,
      [token, safeRole, scrubbed],
    )
    await db.query(
      `UPDATE anonymous_sessions
       SET message_count = message_count + 1,
           mode_used = COALESCE($2, mode_used)
       WHERE session_token = $1`,
      [token, getModeLabel(modeId) || null],
    )
  } catch (error) {
    if (error?.code === '42P01') return
    console.error('anonymous_chat_log_error', error)
  }
}

async function logAnonymousExchange({ sessionToken, modeId, userText, assistantText }) {
  if (!sessionToken) return
  await logAnonymousMessage(sessionToken, 'user', userText, modeId)
  if (assistantText) {
    await logAnonymousMessage(sessionToken, 'assistant', assistantText, modeId)
  }
}

module.exports = {
  logAnonymousExchange,
  logAnonymousMessage,
}
