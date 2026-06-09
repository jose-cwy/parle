import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end()

  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await db.query('DELETE FROM chat_memory WHERE user_id=$1', [payload.id])
    return res.status(200).json({ ok: true })
  } catch (error) {
    if (error?.code === '42P01') {
      return res.status(200).json({ ok: true, skipped: true })
    }
    console.error('chat_clear_error', error)
    return res.status(500).json({ error: 'Unable to clear chat' })
  }
}

