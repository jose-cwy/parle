import { clearUserMemory, getUserMemory, upsertUserMemory } from '../../../lib/memoryDb'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return
  const payload = guard.payload

  try {
    if (req.method === 'GET') {
      const memory = await getUserMemory(payload.id)
      return res.status(200).json({ memory })
    }

    if (req.method === 'PUT') {
      const { memory } = req.body || {}
      const next = await upsertUserMemory(payload.id, memory || {})
      return res.status(200).json({ memory: next })
    }

    if (req.method === 'DELETE') {
      await clearUserMemory(payload.id)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).end()
  } catch (error) {
    console.error('memory_api_error', error)
    return res.status(500).json({ error: 'Unable to update memory right now.' })
  }
}

