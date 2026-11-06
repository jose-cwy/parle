const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const RUN = process.env.RUN_V2_OPS_HTTP === '1'
const BASE = process.env.TEST_API_BASE || 'http://127.0.0.1:3055'
const { CURRENT_REHEARSAL_BRANCH: REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')
const STAMP = Date.now()
const ADMIN_EMAIL = process.env.V2F_HTTP_ADMIN_EMAIL

const db = require('../../lib/db')
const { signToken } = require('../../lib/auth')
const { wrapUserLegacyTimeline } = require('../../lib/parle/legacyWrapCopy')
const { encrypt } = require('../../lib/security/encryption')

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

async function createUser(label, emailOverride) {
  const email = emailOverride || `v2f-http-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-f-http-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id, email`,
    [email, password, label],
  )
  return inserted.rows[0]
}

async function messageCount(conversationId, userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  return result.rows[0].n
}

test('V2-F HTTP ops control authorization, read_only, audit, and re-enable', { skip: !RUN }, async () => {
  assert.ok(ADMIN_EMAIL, 'V2F_HTTP_ADMIN_EMAIL is required')
  const ident = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id
  `)
  assert.equal(ident.rows[0].branch_id, REHEARSAL_BRANCH)

  const owner = await createUser('owner')
  const member = await createUser('member')
  const admin = await createUser('admin', ADMIN_EMAIL)
  const cookieOwner = cookieFor(owner)
  const cookieMember = cookieFor(member)
  const cookieAdmin = cookieFor(admin)

  await db.query(
    `INSERT INTO chat_memory (user_id, role, text, training_content, created_at)
     VALUES ($1, 'user', $2, $2, $3)`,
    [owner.id, encrypt('v2f-http-legacy'), new Date(Date.UTC(2024, 6, 1))],
  )
  const wrap = await wrapUserLegacyTimeline(owner.id, { writesQuiesced: true, batchSize: 40 })

  const created = await request('/api/conversations', {
    method: 'POST',
    headers: { Cookie: cookieOwner },
    body: { modeId: 'cross' },
  })
  assert.equal(created.status, 201)
  const chatId = created.json().conversation.id

  const liveSend = await request(`/api/conversations/${chatId}/messages`, {
    method: 'POST',
    headers: { Cookie: cookieOwner },
    body: {
      text: 'http live generation should persist',
      idempotencyKey: `v2f-http-live-${STAMP}`,
      testStub: 'ok',
    },
  })
  assert.equal(liveSend.status, 200, liveSend.body.slice(0, 400))
  const afterLive = await messageCount(chatId, owner.id)
  assert.equal(afterLive, 2)

  const anonGet = await request('/api/admin/ops/v2-generation')
  assert.ok(anonGet.status === 401 || anonGet.status === 404)
  const anonPost = await request('/api/admin/ops/v2-generation', {
    method: 'POST',
    body: {
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'should not work unauthenticated',
      expectedRevision: 0,
    },
  })
  assert.ok(anonPost.status === 401 || anonPost.status === 404)

  const memberGet = await request('/api/admin/ops/v2-generation', {
    headers: { Cookie: cookieMember },
  })
  assert.equal(memberGet.status, 404)
  const memberPost = await request('/api/admin/ops/v2-generation', {
    method: 'POST',
    headers: { Cookie: cookieMember },
    body: {
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'ordinary user must not pause generation',
      expectedRevision: 0,
    },
  })
  assert.equal(memberPost.status, 404)

  const current = await request('/api/admin/ops/v2-generation', {
    headers: { Cookie: cookieAdmin },
  })
  assert.equal(current.status, 200, current.body.slice(0, 400))
  let revision = Number(current.json().revision) || 0

  const missingConfirm = await request('/api/admin/ops/v2-generation', {
    method: 'POST',
    headers: { Cookie: cookieAdmin },
    body: {
      value: 'read_only',
      confirm: 'LIVE',
      reason: 'wrong confirmation string here',
      expectedRevision: revision,
    },
  })
  assert.equal(missingConfirm.status, 400)
  assert.equal(missingConfirm.json().error, 'confirmation_required')

  const missingReason = await request('/api/admin/ops/v2-generation', {
    method: 'POST',
    headers: { Cookie: cookieAdmin },
    body: {
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'short',
      expectedRevision: revision,
    },
  })
  assert.equal(missingReason.status, 400)

  const paused = await request('/api/admin/ops/v2-generation', {
    method: 'POST',
    headers: { Cookie: cookieAdmin },
    body: {
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'http rehearsal pause generation',
      expectedRevision: revision,
    },
  })
  assert.equal(paused.status, 200, paused.body.slice(0, 400))
  assert.equal(paused.json().value, 'read_only')
  revision = paused.json().revision

  const audit = await db.query(
    `SELECT new_value, reason, actor_id FROM parle_ops_control_audit
     WHERE key = 'v2_generation' AND revision = $1`,
    [revision],
  )
  assert.equal(audit.rows[0].new_value, 'read_only')
  assert.equal(audit.rows[0].actor_id, admin.id)
  assert.match(audit.rows[0].reason, /http rehearsal pause/)

  const beforeBlock = await messageCount(chatId, owner.id)
  const blocked = await request(`/api/conversations/${chatId}/messages`, {
    method: 'POST',
    headers: { Cookie: cookieOwner },
    body: {
      text: 'http blocked while read_only',
      idempotencyKey: `v2f-http-block-${STAMP}`,
      testStub: 'ok',
    },
  })
  assert.equal(blocked.status, 503)
  assert.equal(blocked.json().error, 'generation_unavailable')
  assert.equal(await messageCount(chatId, owner.id), beforeBlock)

  const listed = await request('/api/conversations', { headers: { Cookie: cookieOwner } })
  assert.equal(listed.status, 200)
  assert.equal(listed.json().conversations.some((row) => row.id === chatId), true)
  assert.equal(listed.json().generation.available, false)
  const got = await request(`/api/conversations/${chatId}`, { headers: { Cookie: cookieOwner } })
  assert.equal(got.status, 200)
  assert.equal(got.json().messages.length >= 2, true)

  const archived = await request(`/api/conversations/${chatId}`, {
    method: 'PATCH',
    headers: { Cookie: cookieOwner },
    body: { status: 'archived' },
  })
  assert.equal(archived.status, 200)
  assert.equal(archived.json().conversation.status, 'archived')
  const archivedList = await request('/api/conversations?status=archived', {
    headers: { Cookie: cookieOwner },
  })
  assert.equal(archivedList.json().conversations.some((row) => row.id === chatId), true)
  const restored = await request(`/api/conversations/${chatId}`, {
    method: 'PATCH',
    headers: { Cookie: cookieOwner },
    body: { status: 'active' },
  })
  assert.equal(restored.status, 200)
  assert.equal(restored.json().conversation.status, 'active')

  const earlier = await request('/api/conversations/legacy', { headers: { Cookie: cookieOwner } })
  assert.equal(earlier.status, 200)
  assert.equal(earlier.json().conversation.id, wrap.wrapId)
  const wrapGet = await request(`/api/conversations/${wrap.wrapId}`, {
    headers: { Cookie: cookieOwner },
  })
  assert.equal(wrapGet.status, 200)
  assert.equal(wrapGet.json().messages.some((row) => row.text === 'v2f-http-legacy'), true)

  const concurrent = await Promise.all([
    request('/api/admin/ops/v2-generation', {
      method: 'POST',
      headers: { Cookie: cookieAdmin },
      body: {
        value: 'live',
        confirm: 'LIVE',
        reason: 'http concurrent winner resume now',
        expectedRevision: revision,
      },
    }),
    request('/api/admin/ops/v2-generation', {
      method: 'POST',
      headers: { Cookie: cookieAdmin },
      body: {
        value: 'live',
        confirm: 'LIVE',
        reason: 'http concurrent loser resume now',
        expectedRevision: revision,
      },
    }),
  ])
  const won = concurrent.filter((item) => item.status === 200)
  const lost = concurrent.filter((item) => item.status === 409)
  assert.equal(won.length, 1, concurrent.map((item) => `${item.status}:${item.body.slice(0, 80)}`).join('|'))
  assert.equal(lost.length, 1)
  revision = won[0].json().revision
  assert.equal(won[0].json().value, 'live')

  const verified = await request('/api/admin/ops/v2-generation', {
    headers: { Cookie: cookieAdmin },
  })
  assert.equal(verified.json().value, 'live')

  const resume = await request(`/api/conversations/${chatId}/messages`, {
    method: 'POST',
    headers: { Cookie: cookieOwner },
    body: {
      text: 'http resume generation should persist',
      idempotencyKey: `v2f-http-resume-${STAMP}`,
      testStub: 'ok',
    },
  })
  assert.equal(resume.status, 200, resume.body.slice(0, 400))
  assert.ok(await messageCount(chatId, owner.id) > beforeBlock)
})
