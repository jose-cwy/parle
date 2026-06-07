import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { getUserChatSettings } from '../../../lib/parle/preferences'

export default async function handler(req, res) {
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    try {
      const settings = await getUserChatSettings(payload.id)
      return res.status(200).json({
        memory_enabled: settings.memory_enabled,
        last_session_summary: settings.last_session_summary,
        profile: settings.profile,
      })
    } catch (error) {
      if (error?.code === '42P01' || error?.code === '42703') {
        return res.status(200).json({
          memory_enabled: false,
          last_session_summary: null,
          profile: null,
        })
      }
      console.error('chat_context_error', error)
      return res.status(500).json({ error: 'Unable to load chat context' })
    }
  }

  if (req.method === 'PATCH') {
    const { memory_enabled } = req.body || {}
    if (typeof memory_enabled !== 'boolean') {
      return res.status(400).json({ error: 'memory_enabled must be a boolean' })
    }
    try {
      await db.query('UPDATE users SET memory_enabled = $1 WHERE id = $2', [
        memory_enabled,
        payload.id,
      ])
      return res.status(200).json({ memory_enabled })
    } catch (error) {
      if (error?.code === '42703') {
        return res.status(503).json({ error: 'Database migration required' })
      }
      console.error('memory_toggle_error', error)
      return res.status(500).json({ error: 'Unable to update setting' })
    }
  }

  return res.status(405).end()
}
