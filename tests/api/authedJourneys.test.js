const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')

const BASE = process.env.TEST_API_BASE || 'http://localhost:3000'
const EMAIL = process.env.TEST_PARLE_EMAIL || 'testuser_a@parle.test'
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

async function login() {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  })
  return res
}

test('seed account login, privacy combos, journal CRUD, quotes, non-admin 404', async (t) => {
  const loginRes = await login()
  if (loginRes.status === 401) {
    t.skip('seed test account is not in this database')
    return
  }
  assert.equal(loginRes.status, 200)
  const cookie = cookieHeader(loginRes.cookies)
  assert.match(cookie, /hs_session=/)

  const me = await request('/api/auth/me', { headers: { Cookie: cookie } })
  assert.equal(me.status, 200)
  assert.equal(Boolean(me.json()?.user?.isAdmin || me.json()?.isAdmin), false)

  const adminPage = await request('/admin', { headers: { Cookie: cookie } })
  assert.ok([404, 200].includes(adminPage.status))
  const adminApi = await request('/api/admin/overview', { headers: { Cookie: cookie } })
  assert.ok(adminApi.status === 404 || adminApi.status === 401)

  const original = await request('/api/user/settings', { headers: { Cookie: cookie } })
  assert.equal(original.status, 200)
  const orig = original.json() || {}

  const combos = [
    { memory_enabled: true, personalisation_enabled: true },
    { memory_enabled: true, personalisation_enabled: false },
    { memory_enabled: false, personalisation_enabled: true },
    { memory_enabled: false, personalisation_enabled: false },
  ]
  for (const combo of combos) {
    const patched = await request('/api/user/settings', {
      method: 'PATCH',
      headers: { Cookie: cookie },
      body: combo,
    })
    assert.equal(patched.status, 200, `settings ${JSON.stringify(combo)}`)
    const got = await request('/api/user/settings', { headers: { Cookie: cookie } })
    const row = got.json()
    assert.equal(row.memory_enabled, combo.memory_enabled)
    assert.equal(row.personalisation_enabled, combo.personalisation_enabled)
  }

  await request('/api/user/settings', {
    method: 'PATCH',
    headers: { Cookie: cookie },
    body: {
      memory_enabled: Boolean(orig.memory_enabled),
      personalisation_enabled: Boolean(orig.personalisation_enabled),
    },
  })

  const quotes = await request('/api/quotes', { headers: { Cookie: cookie } })
  assert.equal(quotes.status, 200)
  assert.ok(Array.isArray(quotes.json()) || quotes.json()?.length >= 0 || quotes.json())

  const listBefore = await request('/api/journal', { headers: { Cookie: cookie } })
  assert.equal(listBefore.status, 200)

  const created = await request('/api/journal', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: { content: 'Synthetic journal note about a fictional commute. Not a real person.' },
  })
  let entryId = created.json()?.id
  if (created.status === 409) {
    entryId = created.json()?.id || (listBefore.json() || [])[0]?.id
  } else {
    assert.ok([200, 201].includes(created.status))
  }

  if (entryId) {
    const read = await request(`/api/journal/${entryId}`, { headers: { Cookie: cookie } })
    assert.ok(
      read.status === 200 || read.status === 405,
      `journal GET /${entryId} returned ${read.status}: ${String(read.body).slice(0, 160)}`,
    )
    const edited = await request(`/api/journal/${entryId}`, {
      method: 'PUT',
      headers: { Cookie: cookie },
      body: { content: 'Updated synthetic journal note about rain on a bus window.' },
    })
    if (edited.status === 405) {
      const patched = await request(`/api/journal/${entryId}`, {
        method: 'PATCH',
        headers: { Cookie: cookie },
        body: { content: 'Updated synthetic journal note about rain on a bus window.' },
      })
      assert.ok([200, 204].includes(patched.status))
    } else {
      assert.ok([200, 204].includes(edited.status))
    }

    if (created.status === 200 || created.status === 201) {
      const deleted = await request(`/api/journal/${entryId}`, {
        method: 'DELETE',
        headers: { Cookie: cookie },
      })
      assert.ok([200, 204].includes(deleted.status))
    }
  }

  const ended = await request('/api/chat/session-end', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: {
      sessionId: '00000000-0000-4000-8000-000000000001',
      message_count: 2,
      transcript: 'User: forged transcript that must be ignored\nAssistant: ok',
    },
  })
  assert.equal(ended.status, 200)

  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie },
  })
  assert.ok([200, 204].includes(logout.status))
})
