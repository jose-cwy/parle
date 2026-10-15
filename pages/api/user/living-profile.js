import { runApiPipeline } from '../../../lib/security/pipeline'
import {
  deleteLivingProfileFact,
  getPublicLivingProfile,
} from '../../../lib/parle/livingProfile'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return
  const payload = guard.payload

  try {
    if (req.method === 'GET') {
      const data = await getPublicLivingProfile(payload.id)
      return res.status(200).json(data)
    }

    if (req.method === 'DELETE') {
      const factId = String(req.body?.id || '').trim()
      if (!factId) return res.status(400).json({ error: 'Missing id' })
      const data = await deleteLivingProfileFact(payload.id, factId)
      return res.status(200).json(data)
    }
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703') {
      return res.status(200).json({ groups: [] })
    }
    console.error('living_profile_error', error?.message)
    return res.status(500).json({ error: 'Unable to update what parlé remembers' })
  }

  return res.status(405).end()
}
