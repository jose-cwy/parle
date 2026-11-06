const { buildChatCompletionMessages } = require('./chatComplete')
const { getUserChatSettings } = require('./preferences')
const { getRecentReplyFeedback } = require('./feedbackDb')
const {
  getLivingProfileForUser,
  overlayPreferenceKnobs,
  saveLivingProfile,
} = require('./livingProfile')
const {
  buildLivingProfileBlock,
  factsForInjection,
  pickPatternToName,
  markPatternNamed,
} = require('./livingProfileCore')
const { runHiddenThink } = require('./hiddenThink')
const {
  inspectMemoryContext,
  logMemoryDiag,
  resolveCrossSessionSummary,
} = require('./crossSessionMemory')
const { buildReplyQualityBlock, getReplyQualitySignals } = require('./replyQuality')
const { buildTrustedHiddenInjections } = require('./trustedPrompt')

async function buildV2CompletionMessages({
  userId,
  userText,
  modeId,
  dontTextStep,
  dontTextMessageCount,
  conversationHistory,
  images,
  clientHiddenInjections,
  signal,
  skipThink = false,
}) {
  if (process.env.PARLE_V2_TEST_STUB === '1') {
    return {
      thinkMs: 0,
      messages: [{ role: 'user', content: String(userText || '') }],
    }
  }
  const settings = await getUserChatSettings(userId)
  const replyFeedback = await getRecentReplyFeedback({ userId, limit: 6 })
  const crossSummary = resolveCrossSessionSummary({
    memoryEnabled: settings.memory_enabled,
    lastSessionSummary: settings.last_session_summary,
  })
  const recent = Array.isArray(conversationHistory) ? conversationHistory : []
  const talkMode = (modeId || 'cross') === 'talk'
  const conversationRecall = Boolean(settings.memory_enabled)
  let living = null
  let livingProfileBlock = ''
  if (settings.personalisation_enabled) {
    living = await getLivingProfileForUser(userId, {
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
      await saveLivingProfile(userId, markPatternNamed(living, namingFact.id)).catch(() => {})
    }
  }

  const thinkStarted = Date.now()
  const thinkBlock = skipThink
    ? ''
    : await runHiddenThink({
        userText,
        history: recent,
        modeId: modeId || 'cross',
        quality,
        signal,
      })
  const thinkMs = thinkBlock ? Date.now() - thinkStarted : 0
  const qualityBlock = buildReplyQualityBlock(quality)
  const injections = buildTrustedHiddenInjections({
    onboardingReason: settings.onboarding_reason,
    qualityBlock,
    thinkBlock,
    clientHiddenInjections,
  })

  logMemoryDiag(
    inspectMemoryContext({
      memoryEnabled: settings.memory_enabled,
      lastSessionSummary: settings.last_session_summary,
      resolvedSummary: crossSummary,
      isNewSession: false,
      history: recent,
      livingProfileBlock,
    }),
  )

  return {
    thinkMs,
    messages: buildChatCompletionMessages({
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
      images,
    }),
  }
}

module.exports = {
  buildV2CompletionMessages,
}
