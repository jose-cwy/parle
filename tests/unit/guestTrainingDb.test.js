const test = require('node:test')
const assert = require('node:assert/strict')
const { resolveGuestSessionToken } = require('../../lib/parle/guestTrainingDb')
const { scrubPII } = require('../../lib/parle/scrubPII')

test('resolveGuestSessionToken prefers client token', () => {
  const req = { headers: {} }
  assert.equal(resolveGuestSessionToken(req, 'client-token-abc'), 'client-token-abc')
})

test('resolveGuestSessionToken trims and caps client token length', () => {
  const req = { headers: {} }
  const long = `  ${'a'.repeat(200)}  `
  assert.equal(resolveGuestSessionToken(req, long).length, 128)
})

test('resolveGuestSessionToken derives stable fallback from IP and user agent', () => {
  const req = {
    headers: {
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'ParleGuestTest/1.0',
    },
  }
  const first = resolveGuestSessionToken(req, '')
  const second = resolveGuestSessionToken(req, null)
  assert.equal(first, second)
  assert.match(first, /^guest-[a-f0-9]{32}$/)
})

test('scrubPII removes emails and phone numbers for training storage', () => {
  const input = 'Reach me at jane@example.com or 555-123-4567 please'
  const scrubbed = scrubPII(input)
  assert.match(scrubbed, /\[email\]/)
  assert.match(scrubbed, /\[phone\]/)
  assert.doesNotMatch(scrubbed, /jane@example.com/)
})
