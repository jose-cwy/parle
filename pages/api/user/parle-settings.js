import { resetProfile } from '../../../lib/parle/preferences'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return
  const payload = guard.payload

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
