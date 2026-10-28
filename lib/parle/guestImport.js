const { sanitizeChatMessage } = require('../security/sanitize')

const MAX_IMPORT_MESSAGES = 200

function planGuestImport(existingCount, incoming) {
  if (Number(existingCount) > 0) {
    return { skip: true, messages: [] }
  }

  const messages = []
  let lastAt = 0
  const rows = Array.isArray(incoming) ? incoming.slice(0, MAX_IMPORT_MESSAGES) : []

  for (const raw of rows) {
    if (raw?.ephemeral) continue
    const role = raw?.role === 'user' || raw?.role === 'assistant' ? raw.role : null
    const text = sanitizeChatMessage(raw?.text)
    if (!role || !text) continue

    let createdAt = new Date(typeof raw.at === 'number' ? raw.at : Date.now())
    if (Number.isNaN(createdAt.getTime())) createdAt = new Date()
    if (createdAt.getTime() <= lastAt) {
      createdAt = new Date(lastAt + 1)
    }
    lastAt = createdAt.getTime()
    messages.push({ role, text, createdAt })
  }

  return { skip: false, messages }
}

module.exports = {
  MAX_IMPORT_MESSAGES,
  planGuestImport,
}
