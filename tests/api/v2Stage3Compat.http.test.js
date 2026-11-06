const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()

const RUN = process.env.RUN_STAGE3_HTTP === '1'
const BASE = process.env.TEST_API_BASE || 'http://127.0.0.1:3077'
const { CURRENT_REHEARSAL_BRANCH: REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')
const STAMP = Date.now()

const db = require('../../lib/db')
const { signToken } = require('../../lib/auth')
const { createConversation } = require('../../lib/parle/conversations')

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

function cookieFor(user) {
  return `hs_session=${signToken({ id: user.id, email: user.email })}`
}

async function createUser(label) {
  const email = `stage3-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('stage3-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id, email`,
    [email, password, label],
  )
  return inserted.rows[0]
}

test('Stage 3 compatibility: legacy chatbot plus read-only V2 APIs', { skip: !RUN }, async () => {
  const ident = await db.query(`
    SELECT current_setting('neon.project_id', true) AS project_id,
           current_setting('neon.branch_id', true) AS branch_id
  `)
  assert.equal(ident.rows[0].branch_id, REHEARSAL_BRANCH)

  const wrapBefore = await db.query('SELECT COUNT(*)::int AS n FROM user_chat_migration')
  const userA = await createUser('a')
  const userB = await createUser('b')
  const cookieA = cookieFor(userA)
  const cookieB = cookieFor(userB)
  const seeded = await createConversation(userA.id, { modeId: 'cross' })

  const health = await request('/api/health')
  assert.equal(health.status, 200)

  const chatPage = await request('/chat')
  assert.equal(chatPage.status, 200)
  assert.doesNotMatch(chatPage.body, /\/api\/conversations\/\$\{/)

  const guestCrisis = await request('/api/chat/guest-send', {
    method: 'POST',
    headers: { 'x-forwarded-for': `203.0.113.${1 + (Date.now() % 200)}` },
    body: {
      text: 'i just want to disappear',
      modeId: 'cross',
      messages: [],
    },
  })
  assert.equal(guestCrisis.status, 200)
  assert.equal(guestCrisis.json()?.safety, true)

  const send = await request('/api/chat/send', {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: { text: 'i just want to disappear', modeId: 'cross' },
  })
  assert.equal(send.status, 200)
  assert.equal(send.json()?.safety, true)

  const history = await request('/api/chat/history', { headers: { Cookie: cookieA } })
  assert.equal(history.status, 200)
  const historyText = JSON.stringify(history.json())
  assert.match(historyText, /1-767/)

  const listed = await request('/api/conversations', { headers: { Cookie: cookieA } })
  assert.equal(listed.status, 200)
  assert.ok(Array.isArray(listed.json().conversations))

  const created = await request('/api/conversations', {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: { modeId: 'cross' },
  })
  assert.equal(created.status, 403)
  assert.equal(created.json()?.error, 'v2_writes_disabled')

  const putIndex = await request('/api/conversations', {
    method: 'PUT',
    headers: { Cookie: cookieA },
    body: { modeId: 'cross' },
  })
  assert.equal(putIndex.status, 405)
  const deleteIndex = await request('/api/conversations', {
    method: 'DELETE',
    headers: { Cookie: cookieA },
  })
  assert.equal(deleteIndex.status, 405)

  const sentV2 = await request(`/api/conversations/${seeded.id}/messages`, {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: { text: 'should not persist on v2', idempotencyKey: `stage3-${STAMP}` },
  })
  assert.equal(sentV2.status, 403)
  assert.equal(sentV2.json()?.error, 'v2_writes_disabled')

  const patched = await request(`/api/conversations/${seeded.id}`, {
    method: 'PATCH',
    headers: { Cookie: cookieA },
    body: { status: 'archived' },
  })
  assert.equal(patched.status, 403)
  assert.equal(patched.json()?.error, 'v2_writes_disabled')

  const restored = await request(`/api/conversations/${seeded.id}`, {
    method: 'PATCH',
    headers: { Cookie: cookieA },
    body: { status: 'active' },
  })
  assert.equal(restored.status, 403)

  const putId = await request(`/api/conversations/${seeded.id}`, {
    method: 'PUT',
    headers: { Cookie: cookieA },
    body: { status: 'archived' },
  })
  assert.equal(putId.status, 405)
  const deleteId = await request(`/api/conversations/${seeded.id}`, {
    method: 'DELETE',
    headers: { Cookie: cookieA },
  })
  assert.equal(deleteId.status, 405)

  const putMessages = await request(`/api/conversations/${seeded.id}/messages`, {
    method: 'PUT',
    headers: { Cookie: cookieA },
    body: { text: 'no' },
  })
  assert.equal(putMessages.status, 405)

  const postLegacy = await request('/api/conversations/legacy', {
    method: 'POST',
    headers: { Cookie: cookieA },
    body: {},
  })
  assert.equal(postLegacy.status, 405)

  const owned = await request(`/api/conversations/${seeded.id}`, { headers: { Cookie: cookieA } })
  assert.equal(owned.status, 200)
  assert.equal(owned.json()?.conversation?.id, seeded.id)

  const stolen = await request(`/api/conversations/${seeded.id}`, { headers: { Cookie: cookieB } })
  assert.equal(stolen.status, 404)

  const anon = await request('/api/conversations')
  assert.equal(anon.status, 401)

  const legacy = await request('/api/conversations/legacy', { headers: { Cookie: cookieA } })
  assert.equal(legacy.status, 200)
  assert.equal(legacy.json()?.conversation, null)

  const wrapAfter = await db.query('SELECT COUNT(*)::int AS n FROM user_chat_migration')
  assert.equal(wrapAfter.rows[0].n, wrapBefore.rows[0].n)

  const v2Messages = await db.query(
    'SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = $1',
    [seeded.id],
  )
  assert.equal(v2Messages.rows[0].n, 0)
})
