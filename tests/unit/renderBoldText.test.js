const test = require('node:test')
const assert = require('node:assert/strict')
const { parseBoldSegments } = require('../../lib/parle/renderBoldText')

test('parseBoldSegments returns plain text when no bold markers', () => {
  const segments = parseBoldSegments('hello there')
  assert.deepEqual(segments, [{ type: 'text', value: 'hello there' }])
})

test('parseBoldSegments splits bold phrase', () => {
  const segments = parseBoldSegments('not to ignore him. **your evening deserves attention.**')
  assert.equal(segments.length, 2)
  assert.equal(segments[0].type, 'text')
  assert.equal(segments[0].value, 'not to ignore him. ')
  assert.equal(segments[1].type, 'bold')
  assert.equal(segments[1].value, 'your evening deserves attention.')
})

test('parseBoldSegments leaves unmatched asterisks as plain text', () => {
  const segments = parseBoldSegments('use **bold** sparingly and *not italic*')
  assert.equal(segments.length, 3)
  assert.equal(segments[2].value, ' sparingly and *not italic*')
})
