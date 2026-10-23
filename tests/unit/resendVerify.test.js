const test = require('node:test')
const assert = require('node:assert/strict')
const { interpretResendSendResult } = require('../../utils/resend')

test('Resend 1.1 success payload with id is delivered', () => {
  assert.deepEqual(interpretResendSendResult({ id: 'abc' }), { ok: true, id: 'abc' })
})

test('Resend 1.1 HTTP error object without throw is a delivery failure', () => {
  const parsed = interpretResendSendResult({
    name: 'validation_error',
    message: 'Invalid from field',
    statusCode: 422,
  })
  assert.equal(parsed.ok, false)
  assert.equal(parsed.reason, 'delivery_failed')
  assert.equal(parsed.code, 'validation_error')
})

test('newer SDK error envelope without throw is a delivery failure', () => {
  const parsed = interpretResendSendResult({
    data: null,
    error: { name: 'application_error', statusCode: 500 },
  })
  assert.equal(parsed.ok, false)
  assert.equal(parsed.reason, 'delivery_failed')
})

test('empty or unknown payloads are not treated as sent', () => {
  assert.equal(interpretResendSendResult(null).ok, false)
  assert.equal(interpretResendSendResult({}).ok, false)
  assert.equal(interpretResendSendResult({ data: {} }).ok, false)
})
