const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { shouldWipeServerHistory } = require('../../lib/parle/chatClearPolicy')

test('New Chat, switch, and session-end must not wipe account history', () => {
  assert.equal(shouldWipeServerHistory('new_chat'), false)
  assert.equal(shouldWipeServerHistory('switch_chat'), false)
  assert.equal(shouldWipeServerHistory('session_end'), false)
  assert.equal(shouldWipeServerHistory('delete_live_sidebar'), false)
  assert.equal(shouldWipeServerHistory('explicit_account_history_reset'), true)
})

test('HavenChat no longer calls /api/chat/clear from New Chat, switch, or delete', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../components/haven/HavenChat.js'), 'utf8')
  assert.doesNotMatch(src, /fetch\(['"]\/api\/chat\/clear['"]/)
  assert.doesNotMatch(src, /dbKeepCount/)
  assert.doesNotMatch(src, /editDropTrailing/)
})
