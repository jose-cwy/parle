import db from './db'

export async function getUserMemory(userId) {
  const r = await db.query('SELECT memory FROM user_memory WHERE user_id=$1', [userId])
  return r.rows?.[0]?.memory || {}
}

export async function upsertUserMemory(userId, memory) {
  const r = await db.query(
    `INSERT INTO user_memory (user_id, memory, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET memory = EXCLUDED.memory, updated_at = now()
     RETURNING memory`,
    [userId, JSON.stringify(memory || {})],
  )
  return r.rows?.[0]?.memory || {}
}

export async function clearUserMemory(userId) {
  await db.query('DELETE FROM user_memory WHERE user_id=$1', [userId])
  return true
}

