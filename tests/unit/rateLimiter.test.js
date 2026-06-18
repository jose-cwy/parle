const test = require('node:test')
const assert = require('node:assert/strict')
const { checkRateLimit, resolveTier, TIERS } = require('../../lib/rateLimiter')

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
  assert.equal(resolveTier('/api/auth/me'), 'authRead')
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
