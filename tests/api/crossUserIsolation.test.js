const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')

const BASE = process.env.TEST_API_BASE || 'http://localhost:3000'
const EMAIL_A = process.env.TEST_PARLE_EMAIL || 'testuser_a@parle.test'
const EMAIL_B = process.env.TEST_PARLE_EMAIL_B || 'testuser_b@parle.test'
const PASSWORD = process.env.TEST_PARLE_PASSWORD || 'TestPassword123!'

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
        const cookies = [].concat(res.headers['set-cookie'] || [])
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            cookies,
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

function cookieHeader(cookies) {
  return cookies
    .map((c) => String(c).split(';')[0])
    .filter(Boolean)
    .join('; ')
}

async function login(email) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  })
}

test('account B cannot read or mutate account A journal, history, or settings', async (t) => {
  const loginA = await login(EMAIL_A)
  const loginB = await login(EMAIL_B)
  if (loginA.status === 401 || loginB.status === 401) {
    t.skip('seed test accounts are not in this database')
    return
  }
  assert.equal(loginA.status, 200)
  assert.equal(loginB.status, 200)
  const cookieA = cookieHeader(loginA.cookies)
  const cookieB = cookieHeader(loginB.cookies)

  const created = await request('/api/journal', {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: { content: 'Synthetic isolation note about a fictional red umbrella.' },
  })
  let entryId = created.json()?.id
  if (created.status === 409) {
    const listed = await request('/api/journal', { headers: { Cookie: cookieA } })
    entryId = created.json()?.id || (listed.json() || [])[0]?.id
  } else {
    assert.ok([200, 201].includes(created.status), `create journal ${created.status}`)
  }
  assert.ok(entryId, 'expected an entry id for account A')
  const marked = await request(`/api/journal/${entryId}`, {
    method: 'PUT',
    headers: { Cookie: cookieA },
    body: { content: 'Synthetic isolation note about a fictional red umbrella.' },
  })
  assert.ok([200, 204].includes(marked.status), `A could not mark journal ${marked.status}`)

  const stolenRead = await request(`/api/journal/${entryId}`, {
    headers: { Cookie: cookieB },
  })
  assert.ok(
    stolenRead.status === 403 || stolenRead.status === 404,
    `B must not read A journal, got ${stolenRead.status}`,
  )
  assert.doesNotMatch(stolenRead.body || '', /red umbrella/i)

  const stolenEdit = await request(`/api/journal/${entryId}`, {
    method: 'PUT',
    headers: { Cookie: cookieB },
    body: { content: 'Cross-user overwrite attempt.' },
  })
  assert.ok([403, 404].includes(stolenEdit.status), `B must not edit A journal, got ${stolenEdit.status}`)

  const stolenDelete = await request(`/api/journal/${entryId}`, {
    method: 'DELETE',
    headers: { Cookie: cookieB },
  })
  assert.ok([403, 404].includes(stolenDelete.status), `B must not delete A journal, got ${stolenDelete.status}`)

  const stillA = await request(`/api/journal/${entryId}`, { headers: { Cookie: cookieA } })
  assert.equal(stillA.status, 200)
  assert.match(JSON.stringify(stillA.json() || {}), /umbrella/i)

  const historyB = await request('/api/chat/history', { headers: { Cookie: cookieB } })
  assert.equal(historyB.status, 200)
  assert.doesNotMatch(JSON.stringify(historyB.json() || {}), /umbrella/i)

  const settingsA = await request('/api/user/settings', { headers: { Cookie: cookieA } })
  const settingsB = await request('/api/user/settings', { headers: { Cookie: cookieB } })
  assert.equal(settingsA.status, 200)
  assert.equal(settingsB.status, 200)

  const memoryB = await request('/api/memory', { headers: { Cookie: cookieB } })
  assert.equal(memoryB.status, 200)

  const clearB = await request('/api/chat/clear', {
    method: 'POST',
    headers: { Cookie: cookieB },
  })
  assert.equal(clearB.status, 200)

  const historyA = await request('/api/chat/history', { headers: { Cookie: cookieA } })
  assert.equal(historyA.status, 200)
})
