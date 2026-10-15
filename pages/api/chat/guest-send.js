import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { isOutOfScope, getRedirectResponse } from '../../../lib/chatGuardrails'
import {
  logGuestTrainingExchange,
  resolveGuestSessionToken,
} from '../../../lib/parle/guestTrainingDb'
import { getRecentReplyFeedback } from '../../../lib/parle/feedbackDb'
import { buildChatCompletionMessages } from '../../../lib/parle/chatComplete'
import { runHiddenThink } from '../../../lib/parle/hiddenThink'
import { buildReplyQualityBlock, getReplyQualitySignals } from '../../../lib/parle/replyQuality'
import { streamChatReply } from '../../../lib/parle/chatStreamResponse'
import { getModeLabel } from '../../../lib/parle/modes'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { sanitizeChatMessage } from '../../../lib/security/sanitize'
import { validateImageDataUrls } from '../../../lib/security/images'
import {
  runChatAbuseChecks,
  trimConversationHistory,
  withChatProcessing,
} from '../../../lib/chatAbuse'

export const config = {
  api: {
    responseLimit: false,
  },
}

function setGuestUsageHeaders(res, usage) {
  if (!usage) return
  if (usage.remaining != null) {
    res.setHeader('X-Parle-Usage-Remaining', String(usage.remaining))
  }
  if (usage.limit != null) {
    res.setHeader('X-Parle-Usage-Limit', String(usage.limit))
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { tier: 'guestChat' })
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
    const safeModeId = modeId || 'cross'
    const trainingSessionToken = resolveGuestSessionToken(req, sessionToken)

    const abuse = await runChatAbuseChecks(req, res, {
      sessionToken: trainingSessionToken,
      hasImages: safeImages.length > 0,
    })
    if (!abuse.ok) {
      setGuestUsageHeaders(res, abuse.body)
      return res.status(abuse.status).json(abuse.body)
    }

    setGuestUsageHeaders(res, abuse)

    const userText = abuse.userText || sanitizeChatMessage(text) || '(See attached image)'

    if (containsCrisisLanguage(userText)) {
      await logGuestTrainingExchange({
        sessionToken: trainingSessionToken,
        modeId: safeModeId,
        userText,
        assistantText: CRISIS_SAFETY_REPLY,
        replyKind: 'safety',
      }).catch(() => false)
      return res.status(200).json({
        reply: CRISIS_SAFETY_REPLY,
        safety: true,
        sessionToken: trainingSessionToken,
      })
    }

    if (isOutOfScope(userText)) {
      const redirect = getRedirectResponse(userText)
      await logGuestTrainingExchange({
        sessionToken: trainingSessionToken,
        modeId: safeModeId,
        userText,
        assistantText: redirect,
        replyKind: 'guardrail',
      }).catch(() => false)
      return res.status(200).json({
        reply: redirect,
        guardrail: true,
        sessionToken: trainingSessionToken,
      })
    }

    const lockResult = await withChatProcessing(abuse.lockKey, async () => {
      const recent = trimConversationHistory(
        Array.isArray(messages)
          ? messages.map((m) => ({
              role: m.role,
              text: sanitizeChatMessage(m.text),
            }))
          : [],
      )

      const replyFeedback = await getRecentReplyFeedback({
        sessionId: trainingSessionToken,
        limit: 6,
      })

      const quality = getReplyQualitySignals({
        userText,
        history: recent,
        livingProfile: null,
        modeId: safeModeId,
      })
      const thinkBlock = await runHiddenThink({
        userText,
        history: recent,
        modeId: safeModeId,
        quality,
      })
      const injections = [...(hiddenInjections || [])]
      const qualityBlock = buildReplyQualityBlock(quality)
      if (qualityBlock) injections.push(qualityBlock)
      if (thinkBlock) injections.push(thinkBlock)

      const completionMessages = buildChatCompletionMessages({
        modeId: safeModeId,
        dontTextStep,
        dontTextMessageCount,
        preferenceProfile: null,
        livingProfileBlock: '',
        replyFeedback,
        contextRecap: contextRecap
          ? { ...contextRecap, currentMode: contextRecap.currentMode || getModeLabel(modeId) }
          : null,
        crossSessionSummary: null,
        hiddenInjections: injections,
        conversationHistory: recent,
        userText,
        images: safeImages,
      })

      const fallbackReply = `Yeah, that's a lot. ${String(userText).slice(0, 120)}. What's sitting heaviest right now?`

      res.setHeader('X-Parle-Guest-Session', trainingSessionToken)

      const reply = await streamChatReply(res, {
        messages: completionMessages,
        temperature: 0.65,
        fallbackReply,
      })

      await logGuestTrainingExchange({
        sessionToken: trainingSessionToken,
        modeId: safeModeId,
        userText,
        assistantText: reply,
        replyKind: 'normal',
      }).catch(() => false)

      return reply
    })

    if (lockResult.locked) {
      return res.status(429).json({ error: 'processing' })
    }
  } catch (error) {
    return handleApiError(res, error, 'chat_guest_send')
  }
}
