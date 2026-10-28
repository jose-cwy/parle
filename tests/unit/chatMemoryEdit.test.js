const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  MAX_EDIT_TRAILING_DELETE,
  planTrailingDelete,
  applyChatMemoryEditTruncate,
} = require('../../lib/parle/chatMemory')

test('a trailing count of 40 would overlap unrelated older rows on a combined timeline', () => {
  const plan = planTrailingDelete({ serverCount: 12, dropTrailing: 40 })
  assert.equal(plan.apply, true)
  assert.equal(plan.drop, 12)
  assert.equal(plan.keep, 0)
})

test('forged dropTrailing remains a suffix guess, not row ownership', () => {
  const plan = planTrailingDelete({ serverCount: 200, dropTrailing: 40 })
  assert.equal(plan.drop, MAX_EDIT_TRAILING_DELETE)
  assert.equal(plan.keep, 160)
})

test('edit/resend truncate is disabled until conversation rows can be identified', async () => {
  const result = await applyChatMemoryEditTruncate('00000000-0000-0000-0000-000000000001', {
    isEdit: true,
    dropTrailing: 40,
  })
  assert.equal(result.applied, false)
  assert.equal(result.reason, 'disabled_no_conversation_ids')
})

test('send handler does not delete chat_memory on edit or resend', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../pages/api/chat/send.js'), 'utf8')
  assert.doesNotMatch(src, /truncateChatMemory/)
  assert.doesNotMatch(src, /applyChatMemoryEditTruncate/)
  assert.doesNotMatch(src, /editDropTrailing/)
  assert.match(src, /resolveImmediateConversationHistory/)
})
