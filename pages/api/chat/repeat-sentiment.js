import { openaiChatComplete } from '../../../lib/openai'
import { REPEAT_SENTIMENT_PROMPT } from '../../../lib/parle/prompts'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { sanitizeChatMessage } from '../../../lib/security/sanitize'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return

  try {
    const { recentMessages } = req.body || {}
    if (!Array.isArray(recentMessages) || recentMessages.length < 2) {
      return res.status(200).json({ repeat: false })
    }

    const transcript = recentMessages
      .slice(-6)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeChatMessage(m.text).slice(0, 400)}`)
      .join('\n')

    const answer = await openaiChatComplete({
      messages: [
        { role: 'system', content: REPEAT_SENTIMENT_PROMPT },
        { role: 'user', content: transcript },
      ],
      temperature: 0,
    })
    const repeat = String(answer || '')
      .trim()
      .toLowerCase()
      .startsWith('yes')
    return res.status(200).json({ repeat })
  } catch (error) {
    console.error('repeat_sentiment_error', error)
    return res.status(200).json({ repeat: false })
  }
}
