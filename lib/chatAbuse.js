const { LIMITS, sanitizeChatMessage } = require('./security/sanitize')
const { getClientIp } = require('./security/rateLimit')
const { sessionKey, isProcessing, withProcessingLock } = require('./chatProcessingLock')
const { checkAndIncrementDailyUsage } = require('./usageTracking')

const MAX_MESSAGE_LENGTH = LIMITS.chatMessage
const MAX_HISTORY_MESSAGES = 20

function validateChatMessageInput(text, { allowImageOnly = false } = {}) {
  const raw = String(text || '')

  if (!raw.trim() && !allowImageOnly) {
    return {
      ok: false,
      status: 400,
      body: { error: 'empty_message', message: 'message cannot be empty.' },
    }
  }

  if (raw.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'message_too_long',
        message:
          'message is too long. try splitting your thoughts into shorter messages.',
        maxLength: MAX_MESSAGE_LENGTH,
      },
    }
  }

  const sanitized = sanitizeChatMessage(text)

  return { ok: true, text: sanitized || '' }
}

function trimConversationHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .slice(-MAX_HISTORY_MESSAGES)
}

async function runChatAbuseChecks(req, res, { userId, sessionToken, hasImages }) {
  const ip = getClientIp(req)
  const key = sessionKey({ userId, sessionToken, ip })

  if (isProcessing(key)) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'processing',
        message: 'still thinking about your last message...',
      },
    }
  }

  const daily = await checkAndIncrementDailyUsage({
    userId,
    ip,
    isGuest: !userId,
  })

  if (!daily.allowed) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'daily_limit_reached',
        message: daily.message,
        isGuest: daily.isGuest,
        limit: daily.limit,
      },
    }
  }

  const text = req.body?.text
  const messageCheck = validateChatMessageInput(text, { allowImageOnly: hasImages })
  if (!messageCheck.ok) {
    return messageCheck
  }

  return { ok: true, userText: messageCheck.text, lockKey: key, ip }
}

async function withChatProcessing(key, handler) {
  return withProcessingLock(key, handler)
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES,
  validateChatMessageInput,
  trimConversationHistory,
  runChatAbuseChecks,
  withChatProcessing,
}
