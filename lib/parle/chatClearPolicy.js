/**
 * chat_memory is one timeline per user. /api/chat/clear deletes that whole
 * timeline. Sidebar chats are local archives, so New Chat / switch / session-end
 * must not wipe the server copy.
 */
const ACCOUNT_WIDE_CLEAR_ACTIONS = new Set(['explicit_account_history_reset'])

function shouldWipeServerHistory(action) {
  return ACCOUNT_WIDE_CLEAR_ACTIONS.has(String(action || ''))
}

module.exports = {
  shouldWipeServerHistory,
}
