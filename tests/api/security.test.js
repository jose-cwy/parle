const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')

const BASE = process.env.TEST_API_BASE || 'http://localhost:3000'
const RUN_API = process.env.RUN_API_TESTS === '1'

function request(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE)
    const req = http.request(
      url,
      {
        method,
        headers: {
          Origin: BASE,
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: data,
            json: () => {
              try {
                return JSON.parse(data)
              } catch {
                return null
              }
            },
          })
        })
      },
    )
    req.on('error', reject)
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

test('GET /api/journal requires auth', { skip: !RUN_API }, async () => {
  const res = await request('/api/journal')
  assert.equal(res.status, 401)
})

test('GET /api/chat/history requires auth', { skip: !RUN_API }, async () => {
  const res = await request('/api/chat/history')
  assert.equal(res.status, 401)
})

test('guest chat does not expose API keys', { skip: !RUN_API }, async () => {
  const res = await request('/api/chat/guest-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      text: 'hello',
      modeId: 'cross',
      messages: [],
    },
  })
  const raw = res.body.toLowerCase()
  assert.doesNotMatch(raw, /sk-[a-z0-9]{10,}/)
  assert.doesNotMatch(raw, /openai_api_key/)
})

test('SQL injection in message handled safely', { skip: !RUN_API }, async () => {
  const res = await request('/api/chat/guest-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      text: "'; DROP TABLE users; --",
      modeId: 'cross',
      messages: [],
    },
  })
  assert.ok([200, 400, 429].includes(res.status))
  assert.doesNotMatch(res.body.toLowerCase(), /syntax error/)
})

test('XSS in message not echoed as executable script', { skip: !RUN_API }, async () => {
  const res = await request('/api/chat/guest-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      text: "<script>alert('xss')</script>",
      modeId: 'cross',
      messages: [],
    },
  })
  assert.doesNotMatch(res.body, /<script>alert\('xss'\)<\/script>/)
})

test('missing Content-Type on JSON body rejected or handled', { skip: !RUN_API }, async () => {
  const res = await request('/api/chat/guest-send', {
    method: 'POST',
    body: JSON.stringify({ text: 'hi', modeId: 'cross', messages: [] }),
  })
  assert.ok([200, 400, 415, 429, 500].includes(res.status))
})
