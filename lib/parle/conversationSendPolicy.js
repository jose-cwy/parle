const { validateChatMessageInput } = require('../chatAbuse')
const { checkRateLimit, sendRateLimitResponse, getClientIp } = require('../rateLimiter')
const { checkAndIncrementDailyUsage } = require('../usageTracking')
const { getOwnedConversation, peekRequest, isLiveLease } = require('./conversations')
const { generationUnavailableBody } = require('./v2Recovery')
const { isV2GenerationBlocked } = require('./v2GenerationControl')

function allowTestDailySkip(env = process.env) {
  if (String(env.NODE_ENV || '') === 'production') return false
  return env.PARLE_V2_SKIP_DAILY === '1'
}

function liveLease(request) {
  return isLiveLease(request)
}

async function authorizeConversationSend(req, {
  userId,
  conversationId,
  text,
  idempotencyKey,
}) {
  const conversation = await getOwnedConversation(userId, conversationId, {
    statuses: ['active', 'archived'],
  })
  if (conversation.origin === 'legacy_timeline') {
    return {
      handled: true,
      status: 403,
      body: { error: 'read_only_history' },
    }
  }
  if (conversation.status !== 'active') {
    return {
      handled: true,
      status: 404,
      body: { error: 'Not found' },
    }
  }

  const messageCheck = validateChatMessageInput(text)
  if (!messageCheck.ok) {
    return {
      handled: true,
      status: messageCheck.status,
      body: messageCheck.body,
    }
  }

  const key = String(idempotencyKey || '').trim()
  if (key) {
    const existing = await peekRequest(userId, conversationId, key)
    if (existing?.status === 'completed') {
      return {
        handled: false,
        replay: existing,
        skipQuota: true,
        userText: messageCheck.text,
      }
    }
    if (await isV2GenerationBlocked()) {
      return {
        handled: true,
        status: 503,
        body: generationUnavailableBody(),
      }
    }
    if (liveLease(existing)) {
      return {
        handled: true,
        status: 429,
        body: { error: 'processing' },
        skipQuota: true,
      }
    }
    if (existing) {
      return {
        handled: false,
        skipQuota: true,
        userText: messageCheck.text,
      }
    }
  }

  if (await isV2GenerationBlocked()) {
    return {
      handled: true,
      status: 503,
      body: generationUnavailableBody(),
    }
  }

  const burst = checkRateLimit(req, { tier: 'userChat', userId })
  if (!burst.allowed) {
    return {
      handled: true,
      rateLimited: true,
      status: 429,
      cfg: burst.cfg,
      body: {
        error: burst.cfg.error || 'rate_limited',
        message: burst.cfg.message || 'too many messages. take a breath.',
        retryAfter: burst.cfg.retryAfter,
      },
    }
  }

  const skipDaily = allowTestDailySkip(process.env)
  const daily = skipDaily
    ? { allowed: true }
    : await checkAndIncrementDailyUsage({
        userId,
        ip: getClientIp(req),
        isGuest: false,
      })
  if (!daily.allowed) {
    return {
      handled: true,
      status: 429,
      body: {
        error: 'daily_limit_reached',
        message: daily.message,
        isGuest: false,
        limit: daily.limit,
        remaining: daily.remaining ?? 0,
        used: daily.used,
      },
    }
  }

  return {
    handled: false,
    skipQuota: false,
    userText: messageCheck.text,
  }
}

function sendAuthorizedError(res, decision) {
  if (decision.rateLimited) {
    return sendRateLimitResponse(res, decision.cfg)
  }
  return res.status(decision.status).json(decision.body)
}

module.exports = {
  authorizeConversationSend,
  sendAuthorizedError,
  allowTestDailySkip,
}
