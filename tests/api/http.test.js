const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')

const BASE = process.env.TEST_API_BASE || 'http://localhost:3000'

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
            headers: res.headers,
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

test('GET /api/user/settings requires auth', async () => {
  const res = await request('/api/user/settings')
  assert.equal(res.status, 401)
})

test('POST /api/chat/guest-send crisis returns safety reply', async () => {
  const res = await request('/api/chat/guest-send', {
    method: 'POST',
    body: {
      text: 'i just want to disappear',
      modeId: 'cross',
      messages: [],
    },
  })
  assert.equal(res.status, 200)
  const data = res.json()
  assert.equal(data?.safety, true)
  assert.match(data?.reply || '', /1-767/)
  assert.match(data?.reply || '', /6389 2222/)
  assert.match(data?.reply || '', /chat\.mentalhealth\.sg/)
})

test('POST /api/chat/guest-send does not expose API keys', async () => {
  const res = await request('/api/chat/guest-send', {
    method: 'POST',
    body: {
      text: 'hello there',
      modeId: 'cross',
      messages: [],
    },
  })
  const raw = res.body.toLowerCase()
  assert.doesNotMatch(raw, /sk-[a-z0-9]{10,}/)
  assert.doesNotMatch(raw, /openai_api_key/)
})
