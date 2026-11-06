const { runApiPipeline, handleApiError } = require('../../../../lib/security/pipeline')
const { sendConversationMessage, getConversation } = require('../../../../lib/parle/conversations')
const {
  authorizeConversationSend,
  sendAuthorizedError,
} = require('../../../../lib/parle/conversationSendPolicy')
const { buildV2CompletionMessages } = require('../../../../lib/parle/conversationComplete')
const { resolveV2StreamFn } = require('../../../../lib/parle/v2TestStream')
const { recordAuthedChatActivity } = require('../../../../lib/parle/productEvents')
const { validateImageDataUrls } = require('../../../../lib/security/images')
const { attachClientAbort } = require('../../../../lib/parle/chatStreamResponse')
const { assertV2WritesAllowed } = require('../../../../lib/parle/v2Rollout')

function sendRouteError(res, error, context) {
  if (error?.statusCode) {
    return res.status(error.statusCode).json(error.body || { error: 'Error' })
  }
  return handleApiError(res, error, context)
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = await runApiPipeline(req, res, {
    requireAuth: true,
    tier: 'userChat',
    deferRateLimit: true,
  })
  if (guard.handled) return

  try {
    await assertV2WritesAllowed()
  } catch (error) {
    return sendRouteError(res, error, 'conversations_send')
  }

  const body = req.body || {}
  const conversationId = req.query.id
  const userId = guard.payload.id

  try {
    const imageCheck = validateImageDataUrls(body.images)
    if (!imageCheck.ok) {
      return res.status(400).json({ error: 'Invalid image attachment' })
    }

    const decision = await authorizeConversationSend(req, {
      userId,
      conversationId,
      text: body.text,
      idempotencyKey: body.idempotencyKey,
    })
    if (decision.handled) {
      return sendAuthorizedError(res, decision)
    }
    if (decision.replay) {
      const replayed = await sendConversationMessage(req, res, {
        userId,
        conversationId,
        text: decision.userText,
        idempotencyKey: body.idempotencyKey,
      })
      return res.status(200).json({
        replay: true,
        requestId: replayed.requestId,
        conversationId: replayed.conversationId,
        reply: replayed.reply || '',
      })
    }

    const { containsCrisisLanguage, CRISIS_SAFETY_REPLY } = await import('../../../../lib/chatSafety.js')
    const { isOutOfScope, getRedirectResponse } = await import('../../../../lib/chatGuardrails.js')

    if (containsCrisisLanguage(decision.userText)) {
      const result = await sendConversationMessage(req, res, {
        userId,
        conversationId,
        text: decision.userText,
        idempotencyKey: body.idempotencyKey,
        clientMessageId: body.clientMessageId,
        safetyReply: CRISIS_SAFETY_REPLY,
        safetyKind: 'safety',
      })
      if (result.replay) {
        return res.status(200).json({
          replay: true,
          requestId: result.requestId,
          conversationId: result.conversationId,
          reply: result.reply || CRISIS_SAFETY_REPLY,
          safety: true,
        })
      }
      await recordAuthedChatActivity({
        userId,
        modeId: body.modeId || 'cross',
        sessionKey: conversationId,
        isNewSession: false,
      }).catch(() => null)
      return res.status(200).json({
        reply: result.reply || CRISIS_SAFETY_REPLY,
        safety: true,
        requestId: result.requestId,
        conversationId,
      })
    }

    if (isOutOfScope(decision.userText)) {
      const redirect = getRedirectResponse(decision.userText)
      const result = await sendConversationMessage(req, res, {
        userId,
        conversationId,
        text: decision.userText,
        idempotencyKey: body.idempotencyKey,
        clientMessageId: body.clientMessageId,
        safetyReply: redirect,
        safetyKind: 'guardrail',
      })
      return res.status(200).json({
        reply: result.reply || redirect,
        guardrail: true,
        requestId: result.requestId,
        conversationId,
      })
    }

    const historyAbort = attachClientAbort(req, res)
    let completion
    try {
      const thread = await getConversation(userId, conversationId, { limit: 20 })
      completion = await buildV2CompletionMessages({
        userId,
        userText: decision.userText,
        modeId: body.modeId || 'cross',
        dontTextStep: body.dontTextStep,
        dontTextMessageCount: body.dontTextMessageCount,
        conversationHistory: (thread.messages || []).slice(0, -1),
        images: imageCheck.images,
        clientHiddenInjections: body.hiddenInjections,
        signal: historyAbort.signal,
        skipThink: process.env.PARLE_V2_TEST_STUB === '1',
      })
    } finally {
      historyAbort.dispose()
    }

    const result = await sendConversationMessage(req, res, {
      userId,
      conversationId,
      text: decision.userText,
      idempotencyKey: body.idempotencyKey,
      clientMessageId: body.clientMessageId,
      clientMessages: body.messages,
      completionMessages: completion.messages,
      streamFn: resolveV2StreamFn(req),
    })
    if (result?.replay) {
      return res.status(200).json({
        replay: true,
        requestId: result.requestId,
        conversationId: result.conversationId,
        reply: result.reply || '',
      })
    }
    await recordAuthedChatActivity({
      userId,
      modeId: body.modeId || 'cross',
      sessionKey: conversationId,
      isNewSession: false,
    }).catch(() => null)
    return
  } catch (error) {
    if (res.headersSent) {
      try {
        res.end()
      } catch {
        /* ignore */
      }
      return
    }
    return sendRouteError(res, error, 'conversations_send')
  }
}

module.exports = handler
module.exports.default = handler
module.exports.config = {
  api: {
    responseLimit: false,
  },
}
