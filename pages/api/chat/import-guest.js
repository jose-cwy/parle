import { insertChatMessage, listChatMessages } from '../../../lib/chatMemoryDb'
import { planGuestImport } from '../../../lib/parle/guestImport'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = await runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return

  try {
    const existing = await listChatMessages(guard.payload.id, { limit: 1, order: 'ASC' })
    const plan = planGuestImport(existing.length, req.body?.messages)
    if (plan.skip) {
      return res.status(200).json({ ok: true, imported: 0, skipped: true })
    }

    let imported = 0
    for (const row of plan.messages) {
      await insertChatMessage(guard.payload.id, row.role, row.text, row.createdAt)
      imported += 1
    }

    return res.status(200).json({ ok: true, imported })
  } catch (error) {
    return handleApiError(res, error, 'chat_import_guest')
  }
}
