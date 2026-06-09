const db = require('../db')

async function truncateChatMemory(userId, keepCount) {
  const count = Math.max(0, Number(keepCount) || 0)
  if (count <= 0) {
    await db.query('DELETE FROM chat_memory WHERE user_id = $1', [userId])
    return
  }

  await db.query(
    `DELETE FROM chat_memory
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id FROM chat_memory
         WHERE user_id = $1
         ORDER BY created_at ASC
         LIMIT $2
       )`,
    [userId, count],
  )
}

module.exports = {
  truncateChatMemory,
}
