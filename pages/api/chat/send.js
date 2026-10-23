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
  factsForInjection,
  pickPatternToName,
  markPatternNamed,
} from '../../../lib/parle/livingProfileCore'
import { runHiddenThink } from '../../../lib/parle/hiddenThink'
import {
  inspectMemoryContext,
  logMemoryDiag,
  resolveCrossSessionSummary,
} from '../../../lib/parle/crossSessionMemory'
import { recordAuthedChatActivity } from '../../../lib/parle/productEvents'
import { buildReplyQualityBlock, getReplyQualitySignals } from '../../../lib/parle/replyQuality'
import { truncateChatMemory } from '../../../lib/parle/chatMemory'
import { buildTrustedHiddenInjections } from '../../../lib/parle/trustedPrompt'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { rejectUnverifiedAppSession } from '../../../lib/parle/authAccess'
import { checkRateLimit, sendRateLimitResponse } from '../../../lib/rateLimiter'
import { sanitizeChatMessage } from '../../../lib/security/sanitize'
import { validateImageDataUrls } from '../../../lib/security/images'
import {
  getProcessingBlock,
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

  const guard = runApiPipeline(req, res, {
    requireAuth: true,
    tier: 'userChat',
    deferRateLimit: true,
  })
  if (guard.handled) return
  const payload = guard.payload
  if (await rejectUnverifiedAppSession(res, payload)) return

  try {
    const {
      text,
      modeId,
      dontTextStep,
      dontTextMessageCount,
      isNewSession,
      sessionId,
      images,
      isEdit,
      dbKeepCount,
    } = req.body || {}

    const imageCheck = validateImageDataUrls(images)
    if (!imageCheck.ok) {
      return res.status(400).json({ error: 'Invalid image attachment' })
    }
    const safeImages = imageCheck.images

    const processing = getProcessingBlock(req, { userId: payload.id })
    if (processing.blocked) {
      return res.status(processing.status).json(processing.body)
    }

    const burst = checkRateLimit(req, { tier: 'userChat', userId: payload.id })
    if (!burst.allowed) {
      return sendRateLimitResponse(res, burst.cfg)
    }

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
      await recordAuthedChatActivity({
        userId: payload.id,
        modeId: modeId || 'cross',
        sessionKey: sessionId,
        isNewSession: Boolean(isNewSession),
      }).catch(() => null)
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
      const crossSummary = resolveCrossSessionSummary({
        memoryEnabled: settings.memory_enabled,
        lastSessionSummary: settings.last_session_summary,
      })

      const history = await getRecentChatMessages(payload.id, 20)
      const recent = trimConversationHistory(
        history.slice(0, -1).map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.text,
        })),
      )

      const talkMode = (modeId || 'cross') === 'talk'
      const conversationRecall = Boolean(settings.memory_enabled)
      let living = null
      let livingProfileBlock = ''
      if (settings.personalisation_enabled) {
        living = await getLivingProfileForUser(payload.id, {
          personalisationEnabled: true,
        })
        living = overlayPreferenceKnobs(living, settings.profile)
        if (living && !conversationRecall) {
          living = {
            ...living,
            facts: factsForInjection(living, { conversationRecall: false }),
          }
        }
      }

      const quality = getReplyQualitySignals({
        userText,
        history: recent,
        livingProfile: living,
        modeId: modeId || 'cross',
      })

      if (living) {
        const namingFact = talkMode || !conversationRecall ? null : pickPatternToName(living)
        livingProfileBlock = buildLivingProfileBlock(living, {
          talkMode,
          namingFact,
          liftLength: quality.liftLength,
          conversationRecall,
        })
        if (namingFact) {
          await saveLivingProfile(payload.id, markPatternNamed(living, namingFact.id)).catch(() => {})
        }
      }

      const thinkStarted = Date.now()
      const thinkBlock = await runHiddenThink({
        userText,
        history: recent,
        modeId: modeId || 'cross',
        quality,
      })
      const thinkMs = thinkBlock ? Date.now() - thinkStarted : 0
      const qualityBlock = buildReplyQualityBlock(quality)
      const injections = buildTrustedHiddenInjections({
        onboardingReason: settings.onboarding_reason,
        qualityBlock,
        thinkBlock,
        clientHiddenInjections: req.body?.hiddenInjections,
      })

      const completionMessages = buildChatCompletionMessages({
        modeId: modeId || 'cross',
        dontTextStep,
        dontTextMessageCount,
        preferenceProfile: settings.personalisation_enabled ? settings.profile : null,
        livingProfileBlock,
        replyFeedback,
        contextRecap: null,
        crossSessionSummary: crossSummary,
        memoryEnabled: settings.memory_enabled,
        hiddenInjections: injections,
        conversationHistory: recent,
        userText,
        images: safeImages,
      })

      logMemoryDiag(
        inspectMemoryContext({
          memoryEnabled: settings.memory_enabled,
          lastSessionSummary: settings.last_session_summary,
          resolvedSummary: crossSummary,
          isNewSession,
          history: recent,
          livingProfileBlock,
        }),
      )

      const fallbackReply = `Yeah, that's a lot. ${String(userText).slice(0, 120)}. What's sitting heaviest right now?`

      const reply = await streamChatReply(res, {
        messages: completionMessages,
        temperature: 0.65,
        fallbackReply,
        extraHeaders: { 'X-Parle-Think-Ms': String(thinkMs) },
      })

      return { reply, thinkMs }
    })

    if (lockResult.locked) {
      return res.status(429).json({ error: 'processing' })
    }

    const streamed = lockResult.result || {}
    if (streamed.reply) {
      await insertChatMessage(payload.id, 'assistant', streamed.reply)
    }
    await recordAuthedChatActivity({
      userId: payload.id,
      modeId: modeId || 'cross',
      sessionKey: sessionId,
      isNewSession: Boolean(isNewSession),
    }).catch(() => null)
  } catch (error) {
    return handleApiError(res, error, 'chat_send')
  }
}
