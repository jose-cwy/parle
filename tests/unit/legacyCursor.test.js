const test = require('node:test')
const assert = require('node:assert/strict')
const {
  encodeLegacyCursor,
  decodeLegacyCursor,
  parseLegacyLimit,
  parseTimelineVersion,
} = require('../../lib/parle/legacyCursor')

test('legacy cursor round-trips created_at and message id', () => {
  const id = '2f1c8c20-4a3b-4d5e-9f10-111213141516'
  const cursor = encodeLegacyCursor('2024-01-02T03:04:05.000Z', id, 50)
  const decoded = decodeLegacyCursor(cursor)
  assert.equal(decoded.id, id)
  assert.equal(decoded.position, 50)
  assert.equal(decoded.createdAt, '2024-01-02T03:04:05.000Z')
})

test('invalid cursors and limits fail closed after parse', () => {
  assert.throws(() => decodeLegacyCursor('%%%'), (error) => error.statusCode === 400)
  assert.throws(() => decodeLegacyCursor('bm90LWpzb24'), (error) => error.statusCode === 400)
  assert.throws(() => parseLegacyLimit(0), (error) => error.statusCode === 400)
  assert.equal(parseLegacyLimit(500), 100)
  assert.equal(parseTimelineVersion('1710000000000'), '1710000000000')
  assert.throws(() => parseTimelineVersion('not-a-date'), (error) => error.statusCode === 400)
})

