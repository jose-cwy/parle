import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { buildChatCompletionMessages } from '../../../lib/parle/chatComplete'
import { streamChatReply } from '../../../lib/parle/chatStreamResponse'
import { getModeLabel } from '../../../lib/parle/modes'

export const config = {
  api: {
    responseLimit: false,
  },
}

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
    images,
  } = req.body || {}

  if (!text && !(Array.isArray(images) && images.length)) {
    return res.status(400).json({ error: 'Missing text' })
  }

  const userText = String(text || '').trim() || '(See attached image)'

  if (containsCrisisLanguage(userText)) {
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
    modeId: modeId || 'cross',
    dontTextStep,
    dontTextMessageCount,
    preferenceProfile: null,
    contextRecap: contextRecap
      ? { ...contextRecap, currentMode: contextRecap.currentMode || getModeLabel(modeId) }
      : null,
    crossSessionSummary: null,
    hiddenInjections,
    conversationHistory: recent,
    userText,
    images,
  })

  const fallbackReply = `Yeah, that's a lot. ${String(userText).slice(0, 120)}. What's sitting heaviest right now?`

  await streamChatReply(res, {
    messages: completionMessages,
    temperature: 0.65,
    fallbackReply,
  })
}
