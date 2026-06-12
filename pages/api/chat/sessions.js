import db from '../../../lib/db'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return
  const payload = guard.payload

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
    if (error?.code === '42P01' || error?.code === '42703') {
      return res.status(200).json([])
    }
    console.error('chat_sessions_error', error)
    return res.status(500).json({ error: 'Unable to load sessions' })
  }
}
