const test = require('node:test')
const assert = require('node:assert/strict')
const {
  formatSessionTranscript,
  selectSessionEndRows,
  SESSION_END_MESSAGE_LIMIT,
} = require('../../lib/parle/sessionTranscript')

function makeHistory(n) {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    text: `turn-${i} synthetic line about a fictional roommate named Jules`,
  }))
}

test('short synthetic history is kept in full', () => {
  const rows = makeHistory(6)
  const transcript = formatSessionTranscript(rows)
  assert.match(transcript, /turn-0/)
  assert.match(transcript, /turn-5/)
  assert.equal(transcript.split('\n').length, 6)
})

test('long synthetic history is bounded to the latest turns', () => {
  const rows = makeHistory(80)
  const transcript = formatSessionTranscript(rows)
  const lines = transcript.split('\n')
  assert.equal(lines.length, SESSION_END_MESSAGE_LIMIT)
  assert.doesNotMatch(transcript, /turn-0 /)
  assert.match(transcript, /turn-79/)
  assert.match(transcript, /turn-40/)
})

test('consecutive sessions: message_count keeps only the latest conversation', () => {
  const earlier = makeHistory(12).map((row, i) => ({
    ...row,
    text: `earlier-session-${i} about a fictional bakery on Orchard`,
  }))
  const current = [
    { role: 'user', text: 'current-session user: the bus was late in the rain' },
    { role: 'assistant', text: 'current-session assistant: that sounds draining' },
    { role: 'user', text: 'current-session user: yeah' },
    { role: 'assistant', text: 'current-session assistant: mm' },
  ]
  const mixed = [...earlier, ...current]
  const scoped = selectSessionEndRows(mixed, { messageCount: current.length })
  const transcript = formatSessionTranscript(scoped)
  assert.equal(scoped.length, 4)
  assert.doesNotMatch(transcript, /earlier-session/)
  assert.doesNotMatch(transcript, /bakery/)
  assert.match(transcript, /current-session/)
})

test('empty or missing message_count does not emit a transcript', () => {
  const rows = makeHistory(8)
  assert.deepEqual(selectSessionEndRows(rows, { messageCount: 0 }), [])
  assert.deepEqual(selectSessionEndRows(rows, { messageCount: undefined }), [])
  assert.equal(formatSessionTranscript(selectSessionEndRows(rows, { messageCount: 0 })), '')
})

test('cleared history yields an empty transcript', () => {
  assert.equal(formatSessionTranscript([]), '')
  assert.deepEqual(selectSessionEndRows([], { messageCount: 6 }), [])
})

test('per-message text is truncated', () => {
  const long = 'x'.repeat(2000)
  const transcript = formatSessionTranscript([{ role: 'user', text: long }])
  assert.equal(transcript.startsWith('User: '), true)
  assert.equal(transcript.length <= 'User: '.length + 800, true)
})
