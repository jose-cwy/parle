const test = require('node:test')
const assert = require('node:assert/strict')
const { markDeprecatedRoute } = require('../../lib/parle/deprecationLog')

test('deprecation helper sets headers and does not include bodies', () => {
  const headers = {}
  const res = {
    setHeader(key, value) {
      headers[key] = value
    },
  }
  const logs = []
  const original = console.info
  console.info = (...args) => logs.push(args.join(' '))
  try {
    markDeprecatedRoute(
      {
        method: 'PUT',
        headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
        body: { memory: 'secret must not be logged' },
      },
      res,
      '/api/memory',
    )
  } finally {
    console.info = original
  }
  assert.equal(headers.Deprecation, 'true')
  assert.match(headers.Sunset, /2027/)
  const line = logs.join(' ')
  assert.match(line, /deprecated_route/)
  assert.match(line, /\/api\/memory/)
  assert.doesNotMatch(line, /secret must not be logged/)
})
