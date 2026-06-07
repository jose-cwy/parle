import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { resetProfile } from '../../../lib/parle/preferences'

export default async function handler(req, res) {
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'POST' && req.body?.action === 'reset-preferences') {
    try {
      await resetProfile(payload.id)
      return res.status(200).json({ ok: true })
    } catch (error) {
      if (error?.code === '42P01') {
        return res.status(503).json({ error: 'Database migration required' })
      }
      console.error('reset_preferences_error', error)
      return res.status(500).json({ error: 'Unable to reset preferences' })
    }
  }

  return res.status(405).end()
}
