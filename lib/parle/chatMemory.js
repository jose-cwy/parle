const db = require('../db')

const MAX_EDIT_TRAILING_DELETE = 40

function planTrailingDelete({ serverCount, dropTrailing } = {}) {
  const server = Math.max(0, Math.floor(Number(serverCount) || 0))
  const drop = Math.floor(Number(dropTrailing))
  if (!Number.isFinite(drop) || drop < 1 || server < 1) {
    return { apply: false, keep: server, drop: 0 }
  }
  const capped = Math.min(drop, server, MAX_EDIT_TRAILING_DELETE)
  return { apply: true, keep: server - capped, drop: capped }
}

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

/**
 * chat_memory has no conversation_id. A trailing count cannot prove the
 * rows belong to the visible thread (archives, other tabs, New Chat suffix
 * mismatch, forged dropTrailing, retries). Interim reliability patch: never
 * delete on edit/resend. Local UI may still branch; server history is
 * append-only for this path.
 */
async function applyChatMemoryEditTruncate(_userId, _opts = {}) {
  return { applied: false, reason: 'disabled_no_conversation_ids', keep: null, drop: 0 }
}

module.exports = {
  MAX_EDIT_TRAILING_DELETE,
  planTrailingDelete,
  truncateChatMemory,
  applyChatMemoryEditTruncate,
}
