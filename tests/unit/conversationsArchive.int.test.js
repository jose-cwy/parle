const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()

const db = require('../../lib/db')
const {
  createConversation,
  listConversations,
  getConversation,
  archiveConversation,
  restoreConversation,
  sendConversationMessage,
} = require('../../lib/parle/conversations')

const REHEARSAL_BRANCH = 'br-square-unit-apbswjj3'
const STAMP = Date.now()

function mockReq() {
  return { aborted: false, once() {}, off() {} }
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    chunks: [],
    writableEnded: false,
    setHeader(key, value) {
      this.headers[key] = value
    },
    flushHeaders() {},
    write(chunk) {
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
      return this
    },
  }
}

async function createSynthUser(label) {
  const email = `v2c1-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-c1-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [email, password, label],
  )
  return inserted.rows[0].id
}

async function chatMemoryFingerprint() {
  const result = await db.query(
    `SELECT COUNT(*)::bigint AS n, COALESCE(MAX(id), 0)::bigint AS max_id FROM chat_memory`,
  )
  return { n: String(result.rows[0].n), maxId: String(result.rows[0].max_id) }
}

async function* streamText(text) {
  yield text
}

test('V2-C.1 scoped archive isolates conversations and preserves rows', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is not set')
    return
  }

  const ident = await db.query(`
    SELECT current_setting('neon.project_id', true) AS project_id,
           current_setting('neon.branch_id', true) AS branch_id
  `)
  assert.equal(ident.rows[0].branch_id, REHEARSAL_BRANCH)

  const beforeMemory = await chatMemoryFingerprint()
  const userA = await createSynthUser('a')
  const userB = await createSynthUser('b')

  try {
    const chat1 = await createConversation(userA, { modeId: 'cross' })
    const chat2 = await createConversation(userA, { modeId: 'vent' })
    await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chat1.id,
      text: 'chat one stays',
      idempotencyKey: `c1-${STAMP}`,
      streamFn: () => streamText('assistant-one'),
    })
    await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chat2.id,
      text: 'chat two archives',
      idempotencyKey: `c2-${STAMP}`,
      streamFn: () => streamText('assistant-two'),
    })

    const archived = await archiveConversation(userA, chat2.id)
    assert.equal(archived.status, 'archived')

    const active = await listConversations(userA)
    assert.equal(active.some((row) => row.id === chat1.id), true)
    assert.equal(active.some((row) => row.id === chat2.id), false)

    const hidden = await listConversations(userA, { status: 'archived' })
    assert.equal(hidden.some((row) => row.id === chat2.id), true)
    assert.equal(hidden.some((row) => row.id === chat1.id), false)

    const stillChat1 = await getConversation(userA, chat1.id)
    assert.equal(stillChat1.messages.filter((row) => row.role === 'user').length, 1)
    assert.equal(stillChat1.messages.some((row) => row.text === 'chat two archives'), false)

    const archivedThread = await getConversation(userA, chat2.id)
    assert.equal(archivedThread.conversation.status, 'archived')
    assert.equal(archivedThread.messages.some((row) => row.text === 'chat two archives'), true)

    const messageCount = await db.query(
      `SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = $1 AND user_id = $2`,
      [chat2.id, userA],
    )
    assert.ok(messageCount.rows[0].n >= 2)

    await assert.rejects(() => archiveConversation(userB, chat2.id), (error) => error.statusCode === 404)
    await assert.rejects(() => archiveConversation(userA, '00000000-0000-4000-8000-000000000000'), (error) => error.statusCode === 404)

    const ownerAfterForeign = await db.query(
      `SELECT status FROM conversations WHERE id = $1 AND user_id = $2`,
      [chat2.id, userA],
    )
    assert.equal(ownerAfterForeign.rows[0].status, 'archived')

    await assert.rejects(
      () =>
        sendConversationMessage(mockReq(), mockRes(), {
          userId: userA,
          conversationId: chat2.id,
          text: 'should not send to archived',
          idempotencyKey: `archived-send-${STAMP}`,
          streamFn: () => streamText('nope'),
        }),
      (error) => error.statusCode === 404,
    )

    const restored = await restoreConversation(userA, chat2.id)
    assert.equal(restored.status, 'active')
    const activeAgain = await listConversations(userA)
    assert.equal(activeAgain.some((row) => row.id === chat2.id), true)

    const restoredThread = await getConversation(userA, chat2.id)
    assert.equal(restoredThread.messages.some((row) => row.text === 'chat two archives'), true)

    const afterMemory = await chatMemoryFingerprint()
    assert.deepEqual(afterMemory, beforeMemory)
  } finally {
    await db.query(`DELETE FROM users WHERE id = ANY($1)`, [[userA, userB]])
  }
})
