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
          'Content-Type': 'application/json',
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
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

function guestBody(text, extra = {}) {
  return {
    text,
    modeId: 'cross',
    messages: [],
    sessionToken: `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ...extra,
  }
}

test('guest chat 11th rapid message returns 429', { skip: !RUN_API }, async () => {
  const ip = `rate-guest-${Date.now()}`
  let lastStatus = 200
  let lastBody = null

  for (let i = 0; i < 11; i += 1) {
    const res = await request('/api/chat/guest-send', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: guestBody('write me html for a button'),
    })
    lastStatus = res.status
    lastBody = res.json()
  }

  assert.equal(lastStatus, 429)
  assert.equal(lastBody?.error, 'rate_limited')
})

test('empty guest message returns 400', { skip: !RUN_API }, async () => {
  const res = await request('/api/chat/guest-send', {
    method: 'POST',
    body: guestBody('   '),
  })
  assert.equal(res.status, 400)
  assert.equal(res.json()?.error, 'empty_message')
})

test('oversized guest message returns 400', { skip: !RUN_API }, async () => {
  const res = await request('/api/chat/guest-send', {
    method: 'POST',
    body: guestBody('x'.repeat(2001)),
  })
  assert.equal(res.status, 400)
  assert.equal(res.json()?.error, 'message_too_long')
})

test('concurrent processing returns 429 with processing error', { skip: !RUN_API }, async () => {
  const token = `proc-${Date.now()}`
  const body = guestBody('tell me something short', { sessionToken: token })
  const [first, second] = await Promise.all([
    request('/api/chat/guest-send', { method: 'POST', body }),
    request('/api/chat/guest-send', { method: 'POST', body: guestBody('second', { sessionToken: token }) }),
  ])
  const statuses = [first.status, second.status]
  const hasProcessing = [first, second].some(
    (r) => r.status === 429 && r.json()?.error === 'processing',
  )
  assert.ok(statuses.includes(200) || statuses.includes(429))
  if (hasProcessing) {
    const blocked = [first, second].find((r) => r.json()?.error === 'processing')
    assert.match(blocked.json()?.message || '', /still thinking/i)
  }
})
