const test = require('node:test')
const assert = require('node:assert/strict')
const { shouldIgnoreCommit, shouldReplaceHistoryWithServer } = require('../../lib/parle/sessionCommit')

test('stale generation tokens are ignored', () => {
  assert.equal(
    shouldIgnoreCommit({ storageKey: 'a', opGen: 1, currentOpGen: 2 }),
    true,
  )
  assert.equal(
    shouldIgnoreCommit({ storageKey: 'a', opGen: 2, currentOpGen: 2 }),
    false,
  )
})

test('deleted archive ids are ignored even with matching gen', () => {
  assert.equal(
    shouldIgnoreCommit({
      storageKey: 'gone',
      deletedIds: ['gone'],
      opGen: 3,
      currentOpGen: 3,
    }),
    true,
  )
  assert.equal(
    shouldIgnoreCommit({
      storageKey: 'keep',
      deletedIds: ['gone'],
      opGen: 3,
      currentOpGen: 3,
    }),
    false,
  )
})

test('empty local chat can take server history', () => {
  assert.equal(
    shouldReplaceHistoryWithServer({
      hasPendingReply: false,
      localHasUserMessages: false,
      localCount: 0,
      serverCount: 3,
    }),
    true,
  )
})
