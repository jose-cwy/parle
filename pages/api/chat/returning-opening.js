import { runApiPipeline } from '../../../lib/security/pipeline'
import { openaiChatComplete } from '../../../lib/openai'
import { RETURNING_OPENING_PROMPT } from '../../../lib/parle/prompts'
import { getUserChatSettings } from '../../../lib/parle/preferences'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return
  const payload = guard.payload

  const settings = await getUserChatSettings(payload.id)
  if (!settings.memory_enabled || !settings.last_session_summary) {
    return res.status(200).json({ opening: null })
  }

  try {
    const opening = await openaiChatComplete({
      messages: [
        {
          role: 'system',
          content: RETURNING_OPENING_PROMPT(settings.last_session_summary),
        },
        { role: 'user', content: 'Generate the opening line.' },
      ],
      temperature: 0.7,
    })
    return res.status(200).json({ opening: String(opening || '').trim() })
  } catch (error) {
    console.error('returning_opening_error', error)
    return res.status(200).json({ opening: null })
  }
}
