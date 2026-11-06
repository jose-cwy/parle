const test = require('node:test')
const assert = require('node:assert/strict')
const { allowTestDailySkip } = require('../../lib/parle/conversationSendPolicy')
const { resolveUserChatLimit, TIERS } = require('../../lib/rateLimiter')
const { resolveV2StreamFn } = require('../../lib/parle/v2TestStream')
const { isV2GenerationDisabled, publicGenerationState } = require('../../lib/parle/v2Recovery')

test('daily skip is off unless explicitly set and never in production', () => {
  assert.equal(allowTestDailySkip({}), false)
  assert.equal(allowTestDailySkip({ PARLE_V2_SKIP_DAILY: '1' }), true)
  assert.equal(
    allowTestDailySkip({ NODE_ENV: 'production', PARLE_V2_SKIP_DAILY: '1' }),
    false,
  )
})

test('burst override requires the test stub and is ignored in production', () => {
  const cfg = TIERS.userChat
  assert.equal(resolveUserChatLimit(cfg, { PARLE_USERCHAT_BURST: '6' }).limit, cfg.limit)
  assert.equal(
    resolveUserChatLimit(cfg, { PARLE_V2_TEST_STUB: '1', PARLE_USERCHAT_BURST: '6' }).limit,
    6,
  )
  assert.equal(
    resolveUserChatLimit(cfg, {
      NODE_ENV: 'production',
      PARLE_V2_TEST_STUB: '1',
      PARLE_USERCHAT_BURST: '6',
    }).limit,
    cfg.limit,
  )
})

test('recovery generation disable is off by default and ignored in production', () => {
  assert.equal(isV2GenerationDisabled({}), false)
  assert.equal(isV2GenerationDisabled({ PARLE_V2_RECOVERY: '1' }), true)
  assert.equal(
    isV2GenerationDisabled({ NODE_ENV: 'production', PARLE_V2_RECOVERY: '1' }),
    false,
  )
  assert.equal(publicGenerationState({ PARLE_V2_RECOVERY: '1' }).available, false)
  assert.equal(publicGenerationState({ NODE_ENV: 'production', PARLE_V2_RECOVERY: '1' }).available, true)
})

test('provider stub is ignored in production even when PARLE_V2_TEST_STUB is set', () => {
  const req = { headers: {}, body: { testStub: 'ok' } }
  const prev = process.env.PARLE_V2_TEST_STUB
  process.env.PARLE_V2_TEST_STUB = '1'
  try {
    assert.equal(typeof resolveV2StreamFn(req, { PARLE_V2_TEST_STUB: '1' }), 'function')
    assert.equal(
      resolveV2StreamFn(req, { NODE_ENV: 'production', PARLE_V2_TEST_STUB: '1' }),
      undefined,
    )
  } finally {
    if (prev == null) delete process.env.PARLE_V2_TEST_STUB
    else process.env.PARLE_V2_TEST_STUB = prev
  }
})
