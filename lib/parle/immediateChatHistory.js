const { sanitizeChatMessage } = require('../security/sanitize')
const { trimConversationHistory } = require('../chatAbuse')

function normalizeHistoryMessage(raw) {
  const role = raw?.role === 'user' || raw?.role === 'assistant' ? raw.role : null
  const text = sanitizeChatMessage(raw?.text || raw?.content)
  if (!role || !text) return null
  return { role, text }
}

/**
 * Immediate model context is the active local conversation, not the account
 * timeline. Client `messages` is the live thread. Cross-session recall stays
 * on last_session_summary / living profile when those settings are on.
 * If a client omits `messages`, a New Chat flag yields empty immediate history
 * instead of falling back to account-wide chat_memory.
 */
function resolveImmediateConversationHistory({
  clientMessages,
  isNewSession,
  dbHistory,
} = {}) {
  if (Array.isArray(clientMessages)) {
    return trimConversationHistory(
      clientMessages.map(normalizeHistoryMessage).filter(Boolean),
    )
  }
  if (isNewSession) return []
  return trimConversationHistory(
    (dbHistory || []).map(normalizeHistoryMessage).filter(Boolean),
  )
}

module.exports = {
  normalizeHistoryMessage,
  resolveImmediateConversationHistory,
}
