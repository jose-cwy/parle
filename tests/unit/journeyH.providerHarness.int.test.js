/**
 * Journey H failure-injection harness.
 * Injects streamFn into sendConversationMessage. Does not start Next, does not
 * set NODE_ENV=production, and cannot be enabled on a production deployment.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()

const db = require('../../lib/db')
const {
  createConversation,
  getConversation,
  sendConversationMessage,
  peekRequest,
  acquireLease,
} = require('../../lib/parle/conversations')
const { v2TestStreamFn, resolveV2StreamFn } = require('../../lib/parle/v2TestStream')

const { CURRENT_REHEARSAL_BRANCH: REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')
const STAMP = Date.now()

function mockReq(overrides = {}) {
  const listeners = {}
  return {
    aborted: false,
    once(event, fn) {
      listeners[event] = listeners[event] || []
      listeners[event].push(fn)
    },
    off(event, fn) {
      listeners[event] = (listeners[event] || []).filter((item) => item !== fn)
    },
    emit(event) {
      for (const fn of listeners[event] || []) fn()
    },
    ...overrides,
    listeners,
  }
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    chunks: [],
    headersSent: false,
    writableEnded: false,
    setHeader(key, value) {
      this.headers[key] = value
    },
    flushHeaders() {
      this.headersSent = true
    },
    write(chunk) {
      this.headersSent = true
      this.chunks.push(String(chunk))
      return true
    },
    end() {
      this.writableEnded = true
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      this.headersSent = true
      return this
    },
  }
}

async function createSynthUser(label) {
  const email = `v2h-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-h-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [email, password, label],
  )
  return inserted.rows[0].id
}

async function requestRow(userId, key) {
  const result = await db.query(
    `SELECT id, status, error_code, user_message_id, assistant_message_id, lease_expires_at
     FROM conversation_requests
     WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, key],
  )
  return result.rows[0]
}

test('production Next cannot enable the provider stub', () => {
  assert.equal(
    resolveV2StreamFn(
      { headers: { 'x-parle-v2-stub': 'fail' }, body: { testStub: 'fail' } },
      { NODE_ENV: 'production', PARLE_V2_TEST_STUB: '1' },
    ),
    undefined,
  )
})

test('Journey H injected provider failures keep the user row and skip assistant persist', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is not set')
    return
  }
  const ident = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    t.skip(`requires rehearsal child ${REHEARSAL_BRANCH}`)
    return
  }

  t.after(async () => {
    await db.pool.end().catch(() => {})
  })

  const userId = await createSynthUser('h')
  const chat = await createConversation(userId, 'cross')

  const failKey = `h-fail-${STAMP}`
  const failRes = mockRes()
  const failed = await sendConversationMessage(mockReq(), failRes, {
    userId,
    conversationId: chat.id,
    text: 'synthetic provider fail',
    idempotencyKey: failKey,
    streamFn: v2TestStreamFn('fail'),
  })
  assert.equal(failed.ok, false)
  assert.equal(failed.providerError, true)
  assert.match(failRes.chunks.join(''), /"error":"provider_error"/)
  const failRow = await requestRow(userId, failKey)
  assert.equal(failRow.status, 'failed')
  assert.equal(failRow.error_code, 'provider_error')
  assert.ok(failRow.user_message_id)
  assert.equal(failRow.assistant_message_id, null)
  assert.ok(new Date(failRow.lease_expires_at).getTime() <= Date.now() + 1000)

  const retryOk = await sendConversationMessage(mockReq(), mockRes(), {
    userId,
    conversationId: chat.id,
    text: 'synthetic provider fail',
    idempotencyKey: failKey,
    streamFn: v2TestStreamFn('ok'),
  })
  assert.equal(retryOk.ok, true)
  const recovered = await requestRow(userId, failKey)
  assert.equal(recovered.status, 'completed')
  assert.ok(recovered.assistant_message_id)
  const userFails = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_messages
     WHERE conversation_id = $1 AND role = 'user' AND id = $2`,
    [chat.id, failRow.user_message_id],
  )
  assert.equal(userFails.rows[0].n, 1)
  const replay = await sendConversationMessage(mockReq(), mockRes(), {
    userId,
    conversationId: chat.id,
    text: 'synthetic provider fail',
    idempotencyKey: failKey,
    streamFn: v2TestStreamFn('ok'),
  })
  assert.equal(replay.replay, true)
  const assistants = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_messages
     WHERE conversation_id = $1 AND role = 'assistant'`,
    [chat.id],
  )
  assert.equal(assistants.rows[0].n, 1)

  const midKey = `h-mid-${STAMP}`
  const midRes = mockRes()
  const mid = await sendConversationMessage(mockReq(), midRes, {
    userId,
    conversationId: chat.id,
    text: 'synthetic mid-stream fail',
    idempotencyKey: midKey,
    streamFn: async function* midFail() {
      yield 'partial-token'
      throw new Error('provider_down')
    },
  })
  assert.equal(mid.ok, false)
  const midRow = await requestRow(userId, midKey)
  assert.equal(midRow.status, 'failed')
  assert.equal(midRow.assistant_message_id, null)
  assert.ok(midRow.user_message_id)
  const midGet = await getConversation(userId, chat.id)
  assert.equal(JSON.stringify(midGet.messages).includes('partial-token'), false)

  const timeoutKey = `h-timeout-${STAMP}`
  const timed = await sendConversationMessage(mockReq(), mockRes(), {
    userId,
    conversationId: chat.id,
    text: 'synthetic provider timeout',
    idempotencyKey: timeoutKey,
    streamFn: v2TestStreamFn('timeout'),
  })
  assert.equal(timed.ok, false)
  const timeoutRow = await requestRow(userId, timeoutKey)
  assert.equal(timeoutRow.status, 'failed')
  assert.ok(timeoutRow.user_message_id)
  assert.equal(timeoutRow.assistant_message_id, null)

  const abortReq = mockReq()
  const hangKey = `h-hang-${STAMP}`
  const hanging = sendConversationMessage(abortReq, mockRes(), {
    userId,
    conversationId: chat.id,
    text: 'synthetic hang then abort',
    idempotencyKey: hangKey,
    streamFn: v2TestStreamFn('hang'),
  })
  await new Promise((resolve) => setTimeout(resolve, 40))
  abortReq.aborted = true
  abortReq.emit('aborted')
  const aborted = await hanging
  assert.equal(aborted.ok, false)
  const hangRow = await requestRow(userId, hangKey)
  assert.equal(hangRow.status, 'cancelled')
  assert.ok(hangRow.user_message_id)
  assert.equal(hangRow.assistant_message_id, null)

  const storedHang = await peekRequest(userId, chat.id, hangKey)
  await db.query(
    `UPDATE conversation_requests SET lease_expires_at = now() - interval '2 seconds' WHERE id = $1`,
    [storedHang.id],
  )
  const retaken = await acquireLease(storedHang)
  assert.equal(retaken.acquired, true)
  assert.notEqual(retaken.request.lease_token, storedHang.lease_token)
})
