import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { isOutOfScope, getRedirectResponse } from '../../../lib/chatGuardrails'
import { insertChatMessage, getRecentChatMessages } from '../../../lib/chatMemoryDb'
import { buildChatCompletionMessages } from '../../../lib/parle/chatComplete'
import { streamChatReply } from '../../../lib/parle/chatStreamResponse'
import { getUserChatSettings } from '../../../lib/parle/preferences'
import { getRecentReplyFeedback } from '../../../lib/parle/feedbackDb'
import {
  getLivingProfileForUser,
  overlayPreferenceKnobs,
  saveLivingProfile,
} from '../../../lib/parle/livingProfile'
import {
  buildLivingProfileBlock,
  pickPatternToName,
  markPatternNamed,
} from '../../../lib/parle/livingProfileCore'
import { runHiddenThink } from '../../../lib/parle/hiddenThink'
import { buildReplyQualityBlock, getReplyQualitySignals } from '../../../lib/parle/replyQuality'
import { getModeLabel } from '../../../lib/parle/modes'
import { truncateChatMemory } from '../../../lib/parle/chatMemory'
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'userChat' })
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

    const abuse = await runChatAbuseChecks(req, res, {
      userId: payload.id,
      hasImages: safeImages.length > 0,
    })
    if (!abuse.ok) {
      return res.status(abuse.status).json(abuse.body)
    }

    const userText = abuse.userText || sanitizeChatMessage(text) || '(See attached image)'

    if (containsCrisisLanguage(userText)) {
      await insertChatMessage(payload.id, 'user', userText)
      await insertChatMessage(payload.id, 'assistant', CRISIS_SAFETY_REPLY)
      return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
    }

    if (isOutOfScope(userText)) {
      const redirect = getRedirectResponse(userText)
      await insertChatMessage(payload.id, 'user', userText)
      await insertChatMessage(payload.id, 'assistant', redirect)
      return res.status(200).json({ reply: redirect, guardrail: true })
    }

    const lockResult = await withChatProcessing(abuse.lockKey, async () => {
      if (isEdit && typeof dbKeepCount === 'number') {
        await truncateChatMemory(payload.id, dbKeepCount)
      }

      await insertChatMessage(payload.id, 'user', userText)

      const settings = await getUserChatSettings(payload.id)
      const replyFeedback = await getRecentReplyFeedback({ userId: payload.id, limit: 6 })
      const crossSummary =
        isNewSession && settings.memory_enabled ? settings.last_session_summary : crossSessionSummary

      let recent
      if (isEdit && Array.isArray(clientMessages)) {
        recent = trimConversationHistory(
          clientMessages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
        ).slice(0, -1)
      } else {
        const history = await getRecentChatMessages(payload.id, 20)
        recent = trimConversationHistory(
          history.slice(0, -1).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            text: m.text,
          })),
        )
      }

      const talkMode = (modeId || 'cross') === 'talk'
      let living = null
      let livingProfileBlock = ''
      if (settings.personalisation_enabled) {
        living = await getLivingProfileForUser(payload.id, {
          personalisationEnabled: true,
        })
        living = overlayPreferenceKnobs(living, settings.profile)
      }

      const quality = getReplyQualitySignals({
        userText,
        history: recent,
        livingProfile: living,
        modeId: modeId || 'cross',
      })

      if (living) {
        const namingFact = talkMode ? null : pickPatternToName(living)
        livingProfileBlock = buildLivingProfileBlock(living, {
          talkMode,
          namingFact,
          liftLength: quality.liftLength,
        })
        if (namingFact) {
          await saveLivingProfile(payload.id, markPatternNamed(living, namingFact.id)).catch(() => {})
        }
      }

      const thinkBlock = await runHiddenThink({
        userText,
        history: recent,
        modeId: modeId || 'cross',
        quality,
      })
      const injections = [...(hiddenInjections || [])]
      const qualityBlock = buildReplyQualityBlock(quality)
      if (qualityBlock) injections.push(qualityBlock)
      if (thinkBlock) injections.push(thinkBlock)

      const completionMessages = buildChatCompletionMessages({
        modeId: modeId || 'cross',
        dontTextStep,
        dontTextMessageCount,
        preferenceProfile: settings.personalisation_enabled ? settings.profile : null,
        livingProfileBlock,
        replyFeedback,
        contextRecap: contextRecap
          ? { ...contextRecap, currentMode: contextRecap.currentMode || getModeLabel(modeId) }
          : null,
        crossSessionSummary: crossSummary,
        hiddenInjections: injections,
        conversationHistory: recent,
        userText,
        images: safeImages,
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(
          '[parle chat] living profile injected:',
          Boolean(livingProfileBlock),
        )
      }

      const fallbackReply = `Yeah, that's a lot. ${String(userText).slice(0, 120)}. What's sitting heaviest right now?`

      const reply = await streamChatReply(res, {
        messages: completionMessages,
        temperature: 0.65,
        fallbackReply,
      })

      await insertChatMessage(payload.id, 'assistant', reply)
      return reply
    })

    if (lockResult.locked) {
      return res.status(429).json({ error: 'processing' })
    }
  } catch (error) {
    return handleApiError(res, error, 'chat_send')
  }
}
