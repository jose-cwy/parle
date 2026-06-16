import { getUserSettings, updateUserSettings } from '../../../lib/parle/userSettings'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'auth' })
  if (guard.handled) return
  const payload = guard.payload

  if (req.method === 'GET') {
    try {
      const settings = await getUserSettings(payload.id)
      return res.status(200).json(settings)
    } catch (error) {
      if (error?.code === '42703') {
        return res.status(503).json({ error: 'Database migration required' })
      }
      console.error('user_settings_get_error', error)
      return res.status(500).json({ error: 'Unable to load settings' })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const settings = await updateUserSettings(payload.id, req.body || {})
      return res.status(200).json(settings)
    } catch (error) {
      if (error?.statusCode === 400) {
        return res.status(400).json({ error: error.message })
      }
      if (error?.code === '42703' || error?.statusCode === 503) {
        return res.status(503).json({ error: 'Database migration required' })
      }
      console.error('user_settings_patch_error', error)
      return res.status(500).json({ error: 'Unable to update settings' })
    }
  }

  return res.status(405).end()
}
