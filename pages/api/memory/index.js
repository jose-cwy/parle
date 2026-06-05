import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { clearUserMemory, getUserMemory, upsertUserMemory } from '../../../lib/memoryDb'

export default async function handler(req, res) {
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

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

