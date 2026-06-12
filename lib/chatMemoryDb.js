const db = require('./db')
const { encrypt, decrypt } = require('./security/encryption')

function decryptRow(row) {
  if (!row) return row
  return {
    ...row,
    text: decrypt(row.text),
  }
}

async function insertChatMessage(userId, role, text, createdAt = new Date()) {
  const stored = encrypt(String(text ?? ''))
  await db.query(
    'INSERT INTO chat_memory (user_id, role, text, created_at) VALUES ($1, $2, $3, $4)',
    [userId, role, stored, createdAt],
  )
}

async function listChatMessages(userId, { limit = 200, order = 'ASC' } = {}) {
  const query =
    order === 'DESC'
      ? 'SELECT role, text, created_at FROM chat_memory WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2'
      : 'SELECT role, text, created_at FROM chat_memory WHERE user_id = $1 ORDER BY created_at ASC LIMIT $2'
  const r = await db.query(query, [userId, limit])
  return (r.rows || []).map(decryptRow)
}

async function getRecentChatMessages(userId, limit = 14) {
  const r = await db.query(
    'SELECT role, text FROM chat_memory WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit],
  )
  return (r.rows || []).map(decryptRow).reverse()
}

module.exports = {
  insertChatMessage,
  listChatMessages,
  getRecentChatMessages,
  decryptRow,
}
