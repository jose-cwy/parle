import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { insertChatMessage, getRecentChatMessages } from '../../../lib/chatMemoryDb'
import { buildChatCompletionMessages } from '../../../lib/parle/chatComplete'
import { streamChatReply } from '../../../lib/parle/chatStreamResponse'
import { getUserChatSettings } from '../../../lib/parle/preferences'
import { getModeLabel } from '../../../lib/parle/modes'
import { truncateChatMemory } from '../../../lib/parle/chatMemory'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { sanitizeChatMessage } from '../../../lib/security/sanitize'
import { validateImageDataUrls } from '../../../lib/security/images'

export const config = {
  api: {
    responseLimit: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return
  const payload = guard.payload

  try {

  const {
    text,
    modeId,
    dontTextStep,
    dontTextMessageCount,
    contextRecap,
    crossSessionSummary,
    hiddenInjections,
    isNewSession,
    images,
    isEdit,
    dbKeepCount,
    messages: clientMessages,
  } = req.body || {}

  const imageCheck = validateImageDataUrls(images)
  if (!imageCheck.ok) {
    return res.status(400).json({ error: 'Invalid image attachment' })
  }
  const safeImages = imageCheck.images

  if (!text && !safeImages.length) {
    return res.status(400).json({ error: 'Missing text' })
  }

  const userText = sanitizeChatMessage(text) || '(See attached image)'

  if (containsCrisisLanguage(userText)) {
    await insertChatMessage(payload.id, 'user', userText)
    await insertChatMessage(payload.id, 'assistant', CRISIS_SAFETY_REPLY)
    return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
  }

  if (isEdit && typeof dbKeepCount === 'number') {
    await truncateChatMemory(payload.id, dbKeepCount)
  }

  await insertChatMessage(payload.id, 'user', userText)

  const settings = await getUserChatSettings(payload.id)
  const crossSummary =
    isNewSession && settings.memory_enabled ? settings.last_session_summary : crossSessionSummary

  let recent
  if (isEdit && Array.isArray(clientMessages)) {
    recent = clientMessages
      .filter((m) => m?.role === 'user' || m?.role === 'assistant')
      .slice(-14)
      .map((m) => ({
        role: m.role,
        text: m.text,
      }))
  } else {
    const history = await getRecentChatMessages(payload.id, 14)
    recent = history
      .slice(0, -1)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        text: m.text,
      }))
  }

  const messages = buildChatCompletionMessages({
    modeId: modeId || 'cross',
    dontTextStep,
    dontTextMessageCount,
    preferenceProfile: settings.profile,
    contextRecap: contextRecap
      ? { ...contextRecap, currentMode: contextRecap.currentMode || getModeLabel(modeId) }
      : null,
    crossSessionSummary: crossSummary,
    hiddenInjections,
    conversationHistory: recent,
    userText,
    images: safeImages,
  })

  const fallbackReply = `Yeah, that's a lot. ${String(userText).slice(0, 120)}. What's sitting heaviest right now?`

  const reply = await streamChatReply(res, {
    messages,
    temperature: 0.65,
    fallbackReply,
  })

  await insertChatMessage(payload.id, 'assistant', reply)
  } catch (error) {
    return handleApiError(res, error, 'chat_send')
  }
}
