const SESSION_END_MESSAGE_LIMIT = 40
const SESSION_END_CHARS_PER_MESSAGE = 800

/**
 * chat_memory has no session_id. New Chat is supposed to DELETE the live
 * buffer after session-end, so the table is "current conversation" in the
 * happy path. If clear fails or a previous session was left behind, taking
 * the last 40 rows would mix conversations.
 *
 * message_count from the client is untrusted *text*, but it is a usable
 * length cap: we never take more rows than the client says this session
 * contained, and never more than SESSION_END_MESSAGE_LIMIT. Empty / missing
 * counts yield no transcript so we do not overwrite last-session summary
 * or living profile.
 */
function selectSessionEndRows(rows, {
  messageCount,
  maxMessages = SESSION_END_MESSAGE_LIMIT,
} = {}) {
  const list = Array.isArray(rows) ? rows : []
  const cap = Number(messageCount)
  if (!Number.isFinite(cap) || cap <= 0) return []
  const limit = Math.min(maxMessages, Math.floor(cap), list.length)
  if (limit <= 0) return []
  return list.slice(-limit)
}

function formatSessionTranscript(rows, {
  maxMessages = SESSION_END_MESSAGE_LIMIT,
  maxCharsPerMessage = SESSION_END_CHARS_PER_MESSAGE,
} = {}) {
  const bounded = selectSessionEndRows(rows, {
    messageCount: maxMessages,
    maxMessages,
  })
  return bounded
    .map((m) => {
      const text = String(m?.text || '').slice(0, maxCharsPerMessage)
      const role = m?.role === 'user' ? 'User' : 'Assistant'
      return `${role}: ${text}`
    })
    .join('\n')
}

module.exports = {
  SESSION_END_MESSAGE_LIMIT,
  SESSION_END_CHARS_PER_MESSAGE,
  selectSessionEndRows,
  formatSessionTranscript,
}
