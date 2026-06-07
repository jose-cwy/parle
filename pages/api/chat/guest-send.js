import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { openaiChatComplete } from '../../../lib/openai'
import { buildChatCompletionMessages, sentenceClamp } from '../../../lib/parle/chatComplete'
import { getModeLabel } from '../../../lib/parle/modes'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    text,
    modeId,
    dontTextStep,
    dontTextMessageCount,
    messages,
    contextRecap,
    hiddenInjections,
  } = req.body || {}

  if (!text) return res.status(400).json({ error: 'Missing text' })

  if (containsCrisisLanguage(text)) {
    return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
  }

  const recent = Array.isArray(messages)
    ? messages
        .filter((m) => m?.role === 'user' || m?.role === 'assistant')
        .slice(-14)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }))
    : []

  const completionMessages = buildChatCompletionMessages({
    modeId: modeId || 'listen',
    dontTextStep,
    dontTextMessageCount,
    preferenceProfile: null,
    contextRecap: contextRecap
      ? { ...contextRecap, currentMode: contextRecap.currentMode || getModeLabel(modeId) }
      : null,
    crossSessionSummary: null,
    hiddenInjections,
    conversationHistory: recent,
    userText: text,
  })

  let reply = ''
  try {
    reply = await openaiChatComplete({ messages: completionMessages, temperature: 0.65 })
  } catch (error) {
    reply = `Yeah, that's a lot. ${String(text).slice(0, 120)}. What's sitting heaviest right now?`
    console.error('guest_chat_model_error', error)
  }

  reply = sentenceClamp(reply, 8)
  return res.status(200).json({ reply })
}
