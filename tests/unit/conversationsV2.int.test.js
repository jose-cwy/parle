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
  sendConversationMessage,
  peekRequest,
  acquireLease,
  persistAssistantIfOwner,
} = require('../../lib/parle/conversations')
const { authorizeConversationSend } = require('../../lib/parle/conversationSendPolicy')
const { getDailyUsage } = require('../../lib/usageTracking')
const indexHandler = require('../../pages/api/conversations/index')

const REHEARSAL_BRANCH = 'br-square-unit-apbswjj3'
const STAMP = Date.now()

function mockReq() {
  return { aborted: false, once() {}, off() {} }
}

function mockRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: null,
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
  return res
}

function mockHttpReq({ method = 'GET', headers = {}, body = null } = {}) {
  return {
    method,
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      ...headers,
    },
    body,
    aborted: false,
    once() {},
    off() {},
  }
}

async function createSynthUser(label) {
  const email = `v2b1-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-b1-pass', 4)
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

function delayedStream(label, ms) {
  return async function* delayed() {
    delayed.startedAt = Date.now()
    await new Promise((resolve) => setTimeout(resolve, ms))
    delayed.endedAt = Date.now()
    yield `reply-${label}`
  }
}

test('V2-B.1 conversation APIs, constraints, isolation, and leases', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is not set')
    return
  }

  const ident = await db.query(`
    SELECT current_setting('neon.project_id', true) AS project_id,
           current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    t.skip(`requires rehearsal child ${REHEARSAL_BRANCH}`)
    return
  }

  const tables = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('conversations', 'conversation_messages', 'conversation_requests')
  `)
  if (tables.rows.length < 3) {
    t.skip('0005 conversation tables are not applied on this rehearsal branch')
    return
  }

  const beforeMemory = await chatMemoryFingerprint()
  const userA = await createSynthUser('a')
  const userB = await createSynthUser('b')
  const createdIds = []

  try {
    const chatA = await createConversation(userA, { modeId: 'cross' })
    const chatA2 = await createConversation(userA, { modeId: 'cross' })
    const chatB = await createConversation(userB, { modeId: 'cross' })
    createdIds.push(chatA.id, chatA2.id, chatB.id)
    assert.notEqual(chatA.id, chatA2.id)
    assert.notEqual(chatA.id, chatB.id)

    const listedA = await listConversations(userA)
    const listedB = await listConversations(userB)
    assert.equal(listedA.some((row) => row.id === chatB.id), false)
    assert.equal(listedB.some((row) => row.id === chatA.id), false)
    assert.equal(listedA.some((row) => row.id === chatA.id), true)

    await assert.rejects(() => getConversation(userB, chatA.id), /not_found/)
    await assert.rejects(
      () =>
        sendConversationMessage(mockReq(), mockRes(), {
          userId: userB,
          conversationId: chatA.id,
          text: 'should not land in A',
          streamFn: () => streamText('nope'),
        }),
      /not_found/,
    )

    await assert.rejects(
      () =>
        db.query(
          `INSERT INTO conversation_messages
            (conversation_id, user_id, role, seq, text_enc)
           VALUES ($1, $2, 'user', 1, 'plain-should-fail')`,
          [chatA.id, userB],
        ),
      /foreign key|violates/i,
    )

    await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chatA.id,
      text: 'marker for chat A only',
      idempotencyKey: `once-${STAMP}`,
      streamFn: () => streamText('assistant for A'),
    })
    await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chatA2.id,
      text: 'marker for chat A2 only',
      idempotencyKey: `a2-${STAMP}`,
      streamFn: () => streamText('assistant for A2'),
    })

    const retry = await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chatA.id,
      text: 'marker for chat A only',
      idempotencyKey: `once-${STAMP}`,
      streamFn: () => streamText('should not persist twice'),
    })
    assert.equal(retry.replay, true)

    const storedA = await db.query(
      `SELECT role, text_enc, seq FROM conversation_messages
       WHERE conversation_id = $1 AND user_id = $2
       ORDER BY seq ASC`,
      [chatA.id, userA],
    )
    assert.equal(storedA.rows.length, 2)
    for (const row of storedA.rows) {
      assert.match(String(row.text_enc), /^enc:v1:/)
      assert.equal(String(row.text_enc).includes('marker for chat A only'), false)
    }

    const decryptedA = await getConversation(userA, chatA.id)
    const decryptedA2 = await getConversation(userA, chatA2.id)
    assert.match(JSON.stringify(decryptedA.messages), /marker for chat A only/)
    assert.equal(JSON.stringify(decryptedA.messages).includes('marker for chat A2 only'), false)
    assert.match(JSON.stringify(decryptedA2.messages), /marker for chat A2 only/)
    assert.equal(JSON.stringify(decryptedA2.messages).includes('marker for chat A only'), false)

    const first = delayedStream('one', 250)
    const second = delayedStream('two', 250)
    const concurrent = await Promise.all([
      sendConversationMessage(mockReq(), mockRes(), {
        userId: userA,
        conversationId: chatA.id,
        text: 'concurrent first',
        idempotencyKey: `c1-${STAMP}`,
        streamFn: first,
      }),
      sendConversationMessage(mockReq(), mockRes(), {
        userId: userA,
        conversationId: chatA.id,
        text: 'concurrent second',
        idempotencyKey: `c2-${STAMP}`,
        streamFn: second,
      }),
    ])
    assert.equal(concurrent.every((row) => row.ok || row.replay), true)
    const seqs = await db.query(
      `SELECT seq FROM conversation_messages WHERE conversation_id = $1 ORDER BY seq ASC`,
      [chatA.id],
    )
    const seqNumbers = seqs.rows.map((row) => Number(row.seq))
    assert.deepEqual(seqNumbers, [...new Set(seqNumbers)].sort((a, b) => a - b))

    let started = 0
    let releaseStarts
    const bothStarted = new Promise((resolve, reject) => {
      releaseStarts = resolve
      setTimeout(() => reject(new Error('separate conversations blocked each other')), 8000)
    })
    function gatedStream(label) {
      return async function* gated() {
        started += 1
        if (started >= 2) releaseStarts()
        await bothStarted
        yield `reply-${label}`
      }
    }
    await Promise.all([
      sendConversationMessage(mockReq(), mockRes(), {
        userId: userA,
        conversationId: chatA.id,
        text: 'independent left',
        idempotencyKey: `left-${STAMP}`,
        streamFn: gatedStream('left'),
      }),
      sendConversationMessage(mockReq(), mockRes(), {
        userId: userA,
        conversationId: chatA2.id,
        text: 'independent right',
        idempotencyKey: `right-${STAMP}`,
        streamFn: gatedStream('right'),
      }),
    ])

    const failedSend = await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chatA.id,
      text: 'provider boom',
      idempotencyKey: `fail-${STAMP}`,
      streamFn: async function* failing() {
        throw new Error('provider_down')
      },
    })
    assert.equal(failedSend.ok, false)
    const failed = await db.query(
      `SELECT status, error_code, user_message_id FROM conversation_requests
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userA, `fail-${STAMP}`],
    )
    assert.equal(failed.rows[0].status, 'failed')
    assert.ok(['empty_reply', 'provider_error'].includes(failed.rows[0].error_code))
    assert.ok(failed.rows[0].user_message_id)

    const recovered = await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chatA.id,
      text: 'provider boom',
      idempotencyKey: `fail-${STAMP}`,
      streamFn: () => streamText('recovered after provider failure'),
    })
    assert.equal(recovered.ok, true)
    const recoveredReq = await db.query(
      `SELECT status, assistant_message_id FROM conversation_requests
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userA, `fail-${STAMP}`],
    )
    assert.equal(recoveredReq.rows[0].status, 'completed')
    assert.ok(recoveredReq.rows[0].assistant_message_id)

    const abortedReq = { aborted: true, once() {}, off() {} }
    const aborted = await sendConversationMessage(abortedReq, mockRes(), {
      userId: userA,
      conversationId: chatA.id,
      text: 'client left mid stream',
      idempotencyKey: `abort-${STAMP}`,
      streamFn: () => streamText('should not persist'),
    })
    assert.equal(aborted.ok, false)
    const cancelled = await db.query(
      `SELECT status, error_code, assistant_message_id FROM conversation_requests
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userA, `abort-${STAMP}`],
    )
    assert.equal(cancelled.rows[0].status, 'cancelled')
    assert.equal(cancelled.rows[0].assistant_message_id, null)

    const fenceKey = `fence-${STAMP}`
    const firstWorker = await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chatA.id,
      text: 'fence original',
      idempotencyKey: fenceKey,
      streamFn: async function* failingFence() {
        throw new Error('provider_down')
      },
    })
    assert.equal(firstWorker.ok, false)
    const storedFence = await peekRequest(userA, chatA.id, fenceKey)
    const firstLease = await acquireLease(storedFence)
    await db.query(
      `UPDATE conversation_requests SET lease_expires_at = now() - interval '2 seconds' WHERE id = $1`,
      [firstLease.request.id],
    )
    const secondLease = await acquireLease(firstLease.request)
    assert.notEqual(secondLease.request.lease_token, firstLease.request.lease_token)
    const stale = await persistAssistantIfOwner({
      userId: userA,
      conversationId: chatA.id,
      requestId: firstLease.request.id,
      leaseToken: firstLease.request.lease_token,
      text: 'stale-writer-must-not-land',
      userMessageId: storedFence.user_message_id,
    })
    assert.equal(stale, null)
    const fresh = await persistAssistantIfOwner({
      userId: userA,
      conversationId: chatA.id,
      requestId: secondLease.request.id,
      leaseToken: secondLease.request.lease_token,
      text: 'owner-writer-ok',
      userMessageId: storedFence.user_message_id,
    })
    assert.ok(fresh?.id)
    const fenceTexts = await getConversation(userA, chatA.id)
    assert.equal(JSON.stringify(fenceTexts.messages).includes('stale-writer-must-not-land'), false)
    assert.match(JSON.stringify(fenceTexts.messages), /owner-writer-ok/)

    const usageBefore = await getDailyUsage({ userId: userA, ip: '127.0.0.1', isGuest: false })
    const quotaReq = mockHttpReq({ method: 'POST' })
    const firstAuth = await authorizeConversationSend(quotaReq, {
      userId: userA,
      conversationId: chatA.id,
      text: 'quota original',
      idempotencyKey: `quota-${STAMP}`,
    })
    assert.equal(firstAuth.handled, false)
    assert.equal(firstAuth.skipQuota, false)
    await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chatA.id,
      text: 'quota original',
      idempotencyKey: `quota-${STAMP}`,
      streamFn: () => streamText('quota assistant'),
    })
    const secondAuth = await authorizeConversationSend(quotaReq, {
      userId: userA,
      conversationId: chatA.id,
      text: 'quota original',
      idempotencyKey: `quota-${STAMP}`,
    })
    assert.equal(secondAuth.skipQuota, true)
    assert.ok(secondAuth.replay)
    const usageAfter = await getDailyUsage({ userId: userA, ip: '127.0.0.1', isGuest: false })
    assert.equal(usageAfter.used, usageBefore.used + 1)

    const canned = await sendConversationMessage(mockReq(), mockRes(), {
      userId: userA,
      conversationId: chatA.id,
      text: 'provider empty no fallback',
      idempotencyKey: `nofallback-${STAMP}`,
      streamFn: async function* failingNoFallback() {
        throw new Error('provider_down')
      },
    })
    assert.equal(canned.ok, false)
    const noFake = await getConversation(userA, chatA.id)
    assert.equal(JSON.stringify(noFake.messages).includes("What's sitting heaviest"), false)

    const guestRes = mockRes()
    await indexHandler(mockHttpReq({ method: 'GET' }), guestRes)
    assert.equal(guestRes.statusCode, 401)

    const memoryRows = await db.query(`SELECT COUNT(*)::int AS n FROM chat_memory WHERE user_id = ANY($1)`, [
      [userA, userB],
    ])
    assert.equal(memoryRows.rows[0].n, 0)
    const afterMemory = await chatMemoryFingerprint()
    assert.deepEqual(afterMemory, beforeMemory)
    assert.equal(ident.rows[0].branch_id, REHEARSAL_BRANCH)
  } finally {
    await db.query(`DELETE FROM users WHERE id = ANY($1)`, [[userA, userB]])
  }
})
