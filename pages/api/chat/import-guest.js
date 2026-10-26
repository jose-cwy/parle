import { insertChatMessage, listChatMessages } from '../../../lib/chatMemoryDb'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { sanitizeChatMessage } from '../../../lib/security/sanitize'

const MAX_IMPORT_MESSAGES = 200

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = await runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return

  try {
    const existing = await listChatMessages(guard.payload.id, { limit: 1, order: 'ASC' })
    if (existing.length) {
      return res.status(200).json({ ok: true, imported: 0, skipped: true })
    }

    const incoming = Array.isArray(req.body?.messages) ? req.body.messages : []
    let imported = 0
    let lastAt = 0

    for (const raw of incoming.slice(0, MAX_IMPORT_MESSAGES)) {
      if (raw?.ephemeral) continue
      const role = raw?.role === 'user' || raw?.role === 'assistant' ? raw.role : null
      const text = sanitizeChatMessage(raw?.text)
      if (!role || !text) continue

      let createdAt = new Date(typeof raw.at === 'number' ? raw.at : Date.now())
      if (Number.isNaN(createdAt.getTime())) createdAt = new Date()
      if (createdAt.getTime() <= lastAt) {
        createdAt = new Date(lastAt + 1)
      }
      lastAt = createdAt.getTime()

      await insertChatMessage(guard.payload.id, role, text, createdAt)
      imported += 1
    }

    return res.status(200).json({ ok: true, imported })
  } catch (error) {
    return handleApiError(res, error, 'chat_import_guest')
  }
}
