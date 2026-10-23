const test = require('node:test')
const assert = require('node:assert/strict')
const {
  checkRateLimit,
  resolveTier,
  TIERS,
  resetRateLimitBuckets,
} = require('../../lib/rateLimiter')
const { getProcessingBlock } = require('../../lib/chatAbuse')
const { acquireProcessing, releaseProcessing, sessionKey } = require('../../lib/chatProcessingLock')

function mockReq(path, ip = '127.0.0.1') {
  return {
    url: path,
    headers: {},
    socket: { remoteAddress: ip },
  }
}

test('resolveTier maps routes to expected tiers', () => {
  assert.equal(resolveTier('/api/auth/login'), 'authStrict')
  assert.equal(resolveTier('/api/auth/register'), 'authStrict')
  assert.equal(resolveTier('/api/auth/verify-email'), 'authStrict')
  assert.equal(resolveTier('/api/auth/google/start'), 'authStrict')
  assert.equal(resolveTier('/api/auth/me'), 'authRead')
  assert.equal(resolveTier('/api/auth/verify-email/status'), 'authRead')
  assert.equal(resolveTier('/api/chat/guest-send'), 'guestChat')
  assert.equal(resolveTier('/api/chat/send'), 'userChat')
  assert.equal(resolveTier('/api/user/settings'), 'settings')
  assert.equal(resolveTier('/api/journal'), 'default')
})

test('guest chat rate limit blocks after max requests', () => {
  const req = mockReq('/api/chat/guest-send', '10.0.0.99')
  const limit = TIERS.guestChat.limit

  for (let i = 0; i < limit; i += 1) {
    const result = checkRateLimit(req, { tier: 'guestChat' })
    assert.equal(result.allowed, true, `request ${i + 1} should pass`)
  }

  const blocked = checkRateLimit(req, { tier: 'guestChat' })
  assert.equal(blocked.allowed, false)
})

test('settings tier allows more requests than auth strict', () => {
  assert.ok(TIERS.settings.limit > TIERS.authStrict.limit)
})

test('authed chat allows a 12-turn minute and still burst-limits', () => {
  resetRateLimitBuckets()
  const req = mockReq('/api/chat/send', '10.0.0.21')
  const userId = 'user-chat-burst-test'
  const limit = TIERS.userChat.limit
  assert.equal(limit >= 40, true)
  assert.ok(limit > TIERS.guestChat.limit)

  for (let i = 0; i < 12; i += 1) {
    const result = checkRateLimit(req, { tier: 'userChat', userId })
    assert.equal(result.allowed, true, `turn ${i + 1} should pass`)
  }
  for (let i = 12; i < limit; i += 1) {
    assert.equal(checkRateLimit(req, { tier: 'userChat', userId }).allowed, true)
  }
  assert.equal(checkRateLimit(req, { tier: 'userChat', userId }).allowed, false)
})

test('authed burst keys are per user, not shared with another account', () => {
  resetRateLimitBuckets()
  const req = mockReq('/api/chat/send', '10.0.0.22')
  const limit = TIERS.userChat.limit
  for (let i = 0; i < limit; i += 1) {
    checkRateLimit(req, { tier: 'userChat', userId: 'user-a' })
  }
  assert.equal(checkRateLimit(req, { tier: 'userChat', userId: 'user-a' }).allowed, false)
  assert.equal(checkRateLimit(req, { tier: 'userChat', userId: 'user-b' }).allowed, true)
})

test('guest chat burst stays stricter than authed chat', () => {
  resetRateLimitBuckets()
  const req = mockReq('/api/chat/guest-send', '10.0.0.23')
  for (let i = 0; i < TIERS.guestChat.limit; i += 1) {
    assert.equal(checkRateLimit(req, { tier: 'guestChat' }).allowed, true)
  }
  assert.equal(checkRateLimit(req, { tier: 'guestChat' }).allowed, false)
})

test('in-flight processing 429 does not consume the chat burst quota', () => {
  resetRateLimitBuckets()
  const req = mockReq('/api/chat/send', '10.0.0.24')
  const userId = 'user-processing-skip'
  const lockKey = sessionKey({ userId, ip: '10.0.0.24' })
  acquireProcessing(lockKey)
  try {
    const blocked = getProcessingBlock(req, { userId })
    assert.equal(blocked.blocked, true)
    assert.equal(blocked.body.error, 'processing')
    for (let i = 0; i < 12; i += 1) {
      assert.equal(checkRateLimit(req, { tier: 'userChat', userId }).allowed, true)
    }
  } finally {
    releaseProcessing(lockKey)
  }
})
