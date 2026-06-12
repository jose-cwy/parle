import { listChatMessages } from '../../../lib/chatMemoryDb'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return

  try {
    const rows = await listChatMessages(guard.payload.id, { limit: 200, order: 'ASC' })
    res.status(200).json(rows)
  } catch (error) {
    return handleApiError(res, error, 'chat_history')
  }
}
