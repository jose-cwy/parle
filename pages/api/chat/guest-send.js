import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { buildSystemPrompt, sentenceClamp } from '../../../lib/chatPrompt'
import { openaiChatComplete } from '../../../lib/openai'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, mood, style, messages } = req.body || {}
  if (!text) return res.status(400).json({ error: 'Missing text' })

  if (containsCrisisLanguage(text)) {
    return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
  }

  const system = buildSystemPrompt({ mood, style })
  const recent = Array.isArray(messages)
    ? messages
        .slice(-14)
        .map((m) => ({
          role: m?.role === 'user' ? 'user' : 'assistant',
          content: String(m?.text || '').slice(0, 1200),
        }))
    : []

  let reply = ''
  try {
    reply = await openaiChatComplete({
      messages: [{ role: 'system', content: system }, ...recent, { role: 'user', content: String(text) }],
      temperature: 0.65,
    })
  } catch (error) {
    reply = `I hear you. ${String(text).slice(0, 140)}. What’s the hardest part of this right now?`
    console.error('guest_chat_model_error', error)
  }

  reply = sentenceClamp(reply, 5)
  return res.status(200).json({ reply })
}

