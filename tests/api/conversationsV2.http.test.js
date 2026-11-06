const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()

const RUN = process.env.RUN_V2_HTTP === '1'
const BASE = process.env.TEST_API_BASE || 'http://127.0.0.1:3053'
const { CURRENT_REHEARSAL_BRANCH: REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')
const STAMP = Date.now()

const db = require('../../lib/db')
const { signToken } = require('../../lib/auth')

function request(path, { method = 'GET', headers = {}, body, abortAfterMs } = {}) {
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
    req.on('error', (error) => {
      if (abortAfterMs && (error.code === 'ECONNRESET' || /aborted/i.test(String(error.message)))) {
        resolve({ status: 0, aborted: true, body: '', json: () => null })
        return
      }
      reject(error)
    })
    if (abortAfterMs) {
      setTimeout(() => {
        req.destroy()
      }, abortAfterMs)
    }
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

function parseSse(body) {
  return String(body || '')
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6))
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

function cookieFor(user) {
  return `hs_session=${signToken({ id: user.id, email: user.email })}`
}

async function createUser(label) {
  const email = `v2b2-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-b2-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id, email`,
    [email, password, label],
  )
  return inserted.rows[0]
}

test('V2-B.2 HTTP/SSE conversation lifecycle on rehearsal Next', { skip: !RUN }, async (t) => {
  const ident = await db.query(`
    SELECT current_setting('neon.project_id', true) AS project_id,
           current_setting('neon.branch_id', true) AS branch_id
  `)
  assert.equal(ident.rows[0].branch_id, REHEARSAL_BRANCH)

  const beforeMemory = await db.query(
    `SELECT COUNT(*)::bigint AS n, COALESCE(MAX(id), 0)::bigint AS max_id FROM chat_memory`,
  )
  const userA = await createUser('a')
  const userB = await createUser('b')
  const cookieA = cookieFor(userA)
  const cookieB = cookieFor(userB)

  try {
    const guest = await request('/api/conversations')
    assert.equal(
      guest.status,
      401,
      `unauthenticated GET /api/conversations returned ${guest.status}: ${String(guest.body).slice(0, 500)}`,
    )

    const created = await request('/api/conversations', {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: { modeId: 'cross' },
    })
    assert.equal(created.status, 201)
    const chatA = created.json().conversation
    assert.ok(chatA?.id)

    const created2 = await request('/api/conversations', {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: { modeId: 'vent' },
    })
    const chatA2 = created2.json().conversation
    const createdB = await request('/api/conversations', {
      method: 'POST',
      headers: { Cookie: cookieB },
      body: { modeId: 'cross' },
    })
    const chatB = createdB.json().conversation

    const listed = await request('/api/conversations', { headers: { Cookie: cookieA } })
    assert.equal(listed.status, 200)
    assert.equal(listed.json().conversations.some((row) => row.id === chatB.id), false)

    const send1 = await request(`/api/conversations/${chatA.id}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: {
        text: 'first rehearsal turn about a fictional red umbrella',
        idempotencyKey: `http-1-${STAMP}`,
        testStub: 'ok',
        modeId: 'cross',
      },
    })
    assert.equal(send1.status, 200)
    const sse1 = parseSse(send1.body)
    assert.ok(sse1.some((event) => event.delta === 'stub-ok'))
    assert.ok(sse1.some((event) => event.done === true))

    const send2 = await request(`/api/conversations/${chatA.id}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: {
        text: 'second rehearsal turn after the first',
        idempotencyKey: `http-2-${STAMP}`,
        testStub: 'ok',
        modeId: 'cross',
      },
    })
    assert.equal(send2.status, 200)

    const loaded = await request(`/api/conversations/${chatA.id}`, { headers: { Cookie: cookieA } })
    assert.equal(loaded.status, 200)
    const loadedJson = loaded.json()
    assert.ok(loadedJson.messages.some((row) => /red umbrella/.test(row.text)))
    assert.ok(loadedJson.messages.some((row) => /second rehearsal/.test(row.text)))

    const retry = await request(`/api/conversations/${chatA.id}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: {
        text: 'first rehearsal turn about a fictional red umbrella',
        idempotencyKey: `http-1-${STAMP}`,
        testStub: 'ok',
      },
    })
    assert.equal(retry.status, 200)
    assert.equal(retry.json()?.replay, true)

    const foreign = await request(`/api/conversations/${chatA.id}`, { headers: { Cookie: cookieB } })
    assert.equal(foreign.status, 404)
    const foreignSend = await request(`/api/conversations/${chatA.id}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieB },
      body: { text: 'should not write', idempotencyKey: `evil-${STAMP}` },
    })
    assert.equal(foreignSend.status, 404)

    const sameChat = await Promise.all([
      request(`/api/conversations/${chatA.id}/messages`, {
        method: 'POST',
        headers: { Cookie: cookieA },
        body: { text: 'concurrent same one', idempotencyKey: `cs1-${STAMP}`, testStub: 'slow' },
      }),
      request(`/api/conversations/${chatA.id}/messages`, {
        method: 'POST',
        headers: { Cookie: cookieA },
        body: { text: 'concurrent same two', idempotencyKey: `cs2-${STAMP}`, testStub: 'slow' },
      }),
    ])
    assert.ok(sameChat.every((row) => row.status === 200 || row.status === 429))
    const seqs = await db.query(
      `SELECT seq FROM conversation_messages WHERE conversation_id = $1 ORDER BY seq`,
      [chatA.id],
    )
    const seqNumbers = seqs.rows.map((row) => Number(row.seq))
    assert.deepEqual(seqNumbers, [...new Set(seqNumbers)].sort((a, b) => a - b))

    const split = await Promise.all([
      request(`/api/conversations/${chatA.id}/messages`, {
        method: 'POST',
        headers: { Cookie: cookieA },
        body: { text: 'left independent', idempotencyKey: `left-${STAMP}`, testStub: 'slow' },
      }),
      request(`/api/conversations/${chatA2.id}/messages`, {
        method: 'POST',
        headers: { Cookie: cookieA },
        body: { text: 'right independent', idempotencyKey: `right-${STAMP}`, testStub: 'slow' },
      }),
    ])
    assert.ok(split.every((row) => row.status === 200))

    const failed = await request(`/api/conversations/${chatA.id}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: { text: 'provider should fail', idempotencyKey: `fail-${STAMP}`, testStub: 'fail' },
    })
    assert.ok(
      failed.status === 200 || failed.status === 500,
      `fail send status ${failed.status}: ${String(failed.body).slice(0, 300)}`,
    )
    const failRow = await db.query(
      `SELECT status, error_code, assistant_message_id FROM conversation_requests
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userA.id, `fail-${STAMP}`],
    )
    assert.ok(failRow.rows[0], `missing failed request row; http ${failed.status} ${String(failed.body).slice(0, 300)}`)
    assert.equal(failRow.rows[0].status, 'failed')
    assert.equal(failRow.rows[0].assistant_message_id, null)

    const recovered = await request(`/api/conversations/${chatA.id}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: { text: 'provider should fail', idempotencyKey: `fail-${STAMP}`, testStub: 'ok' },
    })
    assert.equal(recovered.status, 200)
    const recoveredRow = await db.query(
      `SELECT status, assistant_message_id FROM conversation_requests
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userA.id, `fail-${STAMP}`],
    )
    assert.equal(recoveredRow.rows[0].status, 'completed')
    assert.ok(recoveredRow.rows[0].assistant_message_id)

    await request(`/api/conversations/${chatA.id}/messages`, {
      method: 'POST',
      headers: { Cookie: cookieA },
      body: { text: 'hang then cancel', idempotencyKey: `hang-${STAMP}`, testStub: 'hang' },
      abortAfterMs: 400,
    })
    await new Promise((resolve) => setTimeout(resolve, 800))
    const hangRow = await db.query(
      `SELECT status, assistant_message_id FROM conversation_requests
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userA.id, `hang-${STAMP}`],
    )
    if (hangRow.rows[0]) {
      assert.notEqual(hangRow.rows[0].status, 'completed')
      assert.equal(hangRow.rows[0].assistant_message_id, null)
    }

    const burst = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(`/api/conversations/${chatA.id}/messages`, {
          method: 'POST',
          headers: { Cookie: cookieA, 'x-forwarded-for': `203.0.113.${(STAMP % 50) + 1}` },
          body: { text: `burst ${i}`, idempotencyKey: `burst-${STAMP}-${i}`, testStub: 'ok' },
        }),
      ),
    )
    assert.ok(burst.some((row) => row.status === 429))
    const limited = burst.filter((row) => row.status === 429)
    assert.ok(limited.length >= 1)

    const archive2 = await request(`/api/conversations/${chatA2.id}`, {
      method: 'PATCH',
      headers: { Cookie: cookieA },
      body: { status: 'archived' },
    })
    assert.equal(archive2.status, 200)
    assert.equal(archive2.json().conversation.status, 'archived')

    const listedAfterArchive = await request('/api/conversations', { headers: { Cookie: cookieA } })
    assert.equal(listedAfterArchive.json().conversations.some((row) => row.id === chatA2.id), false)
    assert.equal(listedAfterArchive.json().conversations.some((row) => row.id === chatA.id), true)

    const archivedList = await request('/api/conversations?status=archived', { headers: { Cookie: cookieA } })
    assert.equal(archivedList.json().conversations.some((row) => row.id === chatA2.id), true)

    const archivedMessages = await db.query(
      `SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = $1`,
      [chatA2.id],
    )
    assert.ok(archivedMessages.rows[0].n >= 1)

    const foreignArchive = await request(`/api/conversations/${chatA2.id}`, {
      method: 'PATCH',
      headers: { Cookie: cookieB },
      body: { status: 'archived' },
    })
    assert.equal(foreignArchive.status, 404)
    const stillArchived = await db.query(`SELECT status FROM conversations WHERE id = $1`, [chatA2.id])
    assert.equal(stillArchived.rows[0].status, 'archived')

    const restored = await request(`/api/conversations/${chatA2.id}`, {
      method: 'PATCH',
      headers: { Cookie: cookieA },
      body: { status: 'active' },
    })
    assert.equal(restored.status, 200)
    assert.equal(restored.json().conversation.status, 'active')

    const enc = await db.query(
      `SELECT text_enc FROM conversation_messages WHERE conversation_id = $1`,
      [chatA.id],
    )
    assert.ok(enc.rows.length > 0)
    for (const row of enc.rows) {
      assert.match(String(row.text_enc), /^enc:v1:/)
      assert.equal(String(row.text_enc).includes('red umbrella'), false)
    }

    const afterMemory = await db.query(
      `SELECT COUNT(*)::bigint AS n, COALESCE(MAX(id), 0)::bigint AS max_id FROM chat_memory`,
    )
    assert.equal(String(afterMemory.rows[0].n), String(beforeMemory.rows[0].n))
    assert.equal(String(afterMemory.rows[0].max_id), String(beforeMemory.rows[0].max_id))
  } finally {
    await db.query(`DELETE FROM users WHERE id = ANY($1)`, [[userA.id, userB.id]])
    t.diagnostic(`rehearsal_branch=${ident.rows[0].branch_id}`)
  }
})
