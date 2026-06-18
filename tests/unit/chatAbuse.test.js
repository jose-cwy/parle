const test = require('node:test')
const assert = require('node:assert/strict')
const {
  validateChatMessageInput,
  trimConversationHistory,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES,
} = require('../../lib/chatAbuse')

test('empty message rejected', () => {
  const result = validateChatMessageInput('   ')
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.body.error, 'empty_message')
})

test('message over max length rejected', () => {
  const result = validateChatMessageInput('a'.repeat(MAX_MESSAGE_LENGTH + 1))
  assert.equal(result.ok, false)
  assert.equal(result.status, 400)
  assert.equal(result.body.error, 'message_too_long')
})

test('valid message accepted and sanitized', () => {
  const result = validateChatMessageInput('  hello there  ')
  assert.equal(result.ok, true)
  assert.equal(result.text, 'hello there')
})

test('null bytes and control chars stripped', () => {
  const result = validateChatMessageInput('hello\x00world\x1F')
  assert.equal(result.ok, true)
  assert.equal(result.text, 'helloworld')
})

test('image-only send allowed when flag set', () => {
  const result = validateChatMessageInput('', { allowImageOnly: true })
  assert.equal(result.ok, true)
})

test('trimConversationHistory keeps last N messages', () => {
  const history = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    text: `msg ${i}`,
  }))
  const trimmed = trimConversationHistory(history)
  assert.equal(trimmed.length, MAX_HISTORY_MESSAGES)
  assert.equal(trimmed[0].text, `msg ${30 - MAX_HISTORY_MESSAGES}`)
})
