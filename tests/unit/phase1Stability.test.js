const test = require('node:test')
const assert = require('node:assert/strict')
const { shouldReplaceHistoryWithServer } = require('../../lib/parle/sessionCommit')
const { GUEST_LIMIT_MESSAGE } = require('../../lib/usageTracking')
const { buildReplyFeedbackBlock } = require('../../lib/parle/prompts')

test('server history does not clobber a newer in-flight local chat', () => {
  assert.equal(
    shouldReplaceHistoryWithServer({
      hasPendingReply: true,
      localHasUserMessages: true,
      localCount: 2,
      serverCount: 10,
    }),
    false,
  )
  assert.equal(
    shouldReplaceHistoryWithServer({
      hasPendingReply: false,
      localHasUserMessages: true,
      localCount: 4,
      serverCount: 2,
    }),
    false,
  )
  assert.equal(
    shouldReplaceHistoryWithServer({
      hasPendingReply: false,
      localHasUserMessages: false,
      localCount: 0,
      serverCount: 6,
    }),
    true,
  )
})

test('guest limit copy mentions the rolling window, not midnight today', () => {
  assert.match(GUEST_LIMIT_MESSAGE, /few hours/)
  assert.doesNotMatch(GUEST_LIMIT_MESSAGE, /today/)
})

test('feedback prompt block uses ratings without excerpts', () => {
  const block = buildReplyFeedbackBlock([
    { rating: 'up', reply_excerpt: 'secret transcript should not appear' },
    { rating: 'down', reason: 'felt too generic', reply_excerpt: 'another secret' },
  ])
  assert.match(block, /GOOD/)
  assert.match(block, /felt too generic/)
  assert.doesNotMatch(block, /secret transcript/)
  assert.doesNotMatch(block, /another secret/)
})
