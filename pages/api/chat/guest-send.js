import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { isOutOfScope, getRedirectResponse } from '../../../lib/chatGuardrails'
import { logAnonymousExchange } from '../../../lib/parle/anonymousChatDb'
import { buildChatCompletionMessages } from '../../../lib/parle/chatComplete'
import { streamChatReply } from '../../../lib/parle/chatStreamResponse'
import { getModeLabel } from '../../../lib/parle/modes'
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

  const guard = runApiPipeline(req, res, { tier: 'chat' })
  if (guard.handled) return

  try {
    const {
      text,
      modeId,
      dontTextStep,
      dontTextMessageCount,
      messages,
      contextRecap,
      hiddenInjections,
      images,
      sessionToken,
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
    const safeSessionToken = String(sessionToken || '').trim().slice(0, 128) || null

    if (containsCrisisLanguage(userText)) {
      if (safeSessionToken) {
        void logAnonymousExchange({
          sessionToken: safeSessionToken,
          modeId: modeId || 'cross',
          userText,
          assistantText: CRISIS_SAFETY_REPLY,
        })
      }
      return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
    }

    if (isOutOfScope(userText)) {
      const redirect = getRedirectResponse(userText)
      if (safeSessionToken) {
        void logAnonymousExchange({
          sessionToken: safeSessionToken,
          modeId: modeId || 'cross',
          userText,
          assistantText: redirect,
        })
      }
      return res.status(200).json({ reply: redirect, guardrail: true })
    }

    const recent = Array.isArray(messages)
      ? messages
          .filter((m) => m?.role === 'user' || m?.role === 'assistant')
          .slice(-14)
          .map((m) => ({
            role: m.role,
            text: sanitizeChatMessage(m.text),
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
      images: safeImages,
    })

    const fallbackReply = `Yeah, that's a lot. ${String(userText).slice(0, 120)}. What's sitting heaviest right now?`

    const reply = await streamChatReply(res, {
      messages: completionMessages,
      temperature: 0.65,
      fallbackReply,
    })

    if (safeSessionToken) {
      void logAnonymousExchange({
        sessionToken: safeSessionToken,
        modeId: modeId || 'cross',
        userText,
        assistantText: reply,
      })
    }
  } catch (error) {
    return handleApiError(res, error, 'chat_guest_send')
  }
}
