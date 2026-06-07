import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const result = await db.query(
      `SELECT session_id, created_at, starting_mode, final_mode, message_count
       FROM session_signals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [payload.id],
    )
    return res.status(200).json(result.rows || [])
  } catch (error) {
    console.error('chat_sessions_error', error)
    return res.status(500).json({ error: 'Unable to load sessions' })
  }
}
