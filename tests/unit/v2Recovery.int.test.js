const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../../lib/db')
const { encrypt } = require('../../lib/security/encryption')
const {
  createConversation,
  listConversations,
  listLegacyWrap,
  getConversation,
  archiveConversation,
  restoreConversation,
  sendConversationMessage,
} = require('../../lib/parle/conversations')
const { authorizeConversationSend } = require('../../lib/parle/conversationSendPolicy')
const { wrapUserLegacyTimeline, reconcileUserLegacyWrap, legacyRowFingerprint } = require('../../lib/parle/legacyWrapCopy')
const { isV2GenerationDisabled } = require('../../lib/parle/v2Recovery')

const { CURRENT_REHEARSAL_BRANCH: REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')
const STAMP = Date.now()

function mockReq() {
  return { aborted: false, once() {}, off() {}, headers: {}, socket: { remoteAddress: '127.0.0.1' } }
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    chunks: [],
    writableEnded: false,
    setHeader() {},
    flushHeaders() {},
    write(chunk) {
      this.chunks.push(String(chunk))
      return true
    },
    end() {
      this.writableEnded = true
    },
  }
}

async function createSynthUser(label) {
  const email = `v2d4-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-d4-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [email, password, label],
  )
  return inserted.rows[0].id
}

async function insertMemory(userId, text, at, role = 'user') {
  await db.query(
    `INSERT INTO chat_memory (user_id, role, text, training_content, created_at)
     VALUES ($1, $2, $3, $3, $4)`,
    [userId, role, encrypt(text), at],
  )
}

test('V2-D.4 recovery reads, isolation, wrap idempotency, and revision stale', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is not set')
    return
  }
  const ident = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    t.skip(`not rehearsal branch ${REHEARSAL_BRANCH}`)
    return
  }
  const col = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'conversations' AND column_name = 'timeline_revision'`,
  )
  if (!col.rows[0]) {
    t.skip('timeline_revision is not applied on rehearsal')
    return
  }

  const prevRecovery = process.env.PARLE_V2_RECOVERY
  process.env.PARLE_V2_RECOVERY = '1'

  const owner = await createSynthUser('migrated')
  const incomplete = await createSynthUser('incomplete')
  const legacyOnly = await createSynthUser('legacyonly')
  const stranger = await createSynthUser('stranger')

  try {
    for (let i = 0; i < 6; i += 1) {
      await insertMemory(legacyOnly, `d4-only-${i}`, new Date(Date.UTC(2024, 4, 1, 0, 0, i)))
    }
    const absent = await listLegacyWrap(legacyOnly)
    assert.equal(absent.conversation, null)
    assert.equal(absent.generation.available, false)

    for (let i = 0; i < 8; i += 1) {
      await insertMemory(incomplete, `d4-inc-${i}`, new Date(Date.UTC(2024, 4, 2, 0, 0, i)))
    }
    const partial = await wrapUserLegacyTimeline(incomplete, {
      writesQuiesced: false,
      batchSize: 3,
      maxBatches: 1,
    })
    assert.notEqual(partial.state, 'migrated')
    assert.ok(partial.unmappedCount > 0)
    const partialList = await listLegacyWrap(incomplete)
    assert.equal(partialList.migration.complete, false)
    assert.equal(partialList.conversation.readOnly, true)

    for (let i = 0; i < 55; i += 1) {
      await insertMemory(
        owner,
        i === 0 ? 'd4-legacy-first' : `d4-src-${i}`,
        new Date(Date.UTC(2024, 4, 3, 0, 0, i)),
        i % 2 === 0 ? 'user' : 'assistant',
      )
    }
    const firstWrap = await wrapUserLegacyTimeline(owner, { writesQuiesced: true, batchSize: 40 })
    assert.equal(firstWrap.state, 'migrated')
    assert.equal(firstWrap.unmappedCount, 0)
    const again = await wrapUserLegacyTimeline(owner, { writesQuiesced: true, batchSize: 40 })
    assert.equal(again.mappedCount, firstWrap.mappedCount)
    assert.equal(again.extraDestCount, 0)

    const live = await createConversation(owner)
    await db.query(
      `INSERT INTO conversation_messages (conversation_id, user_id, role, seq, text_enc, created_at)
       VALUES ($1, $2, 'user', 1, $3, now()), ($1, $2, 'assistant', 2, $4, now())`,
      [live.id, owner, encrypt('d4-v2-live'), encrypt('d4-v2-live-reply')],
    )
    const other = await createConversation(owner)
    await db.query(
      `INSERT INTO conversation_messages (conversation_id, user_id, role, seq, text_enc, created_at)
       VALUES ($1, $2, 'user', 1, $3, now())`,
      [other.id, owner, encrypt('d4-v2-archived')],
    )
    await archiveConversation(owner, other.id)
    await db.query(
      `INSERT INTO conversation_requests
        (user_id, conversation_id, idempotency_key, status, error_code)
       VALUES ($1, $2, $3, 'failed', 'provider_error')`,
      [owner, live.id, `d4-fail-${STAMP}`],
    )

    const beforeMemory = await legacyRowFingerprint(owner)
    const listed = await listConversations(owner)
    assert.equal(listed.some((row) => row.id === live.id), true)
    assert.equal(listed.every((row) => row.origin !== 'legacy_timeline'), true)
    const archived = await listConversations(owner, { status: 'archived' })
    assert.equal(archived.some((row) => row.id === other.id), true)

    const liveGet = await getConversation(owner, live.id)
    assert.equal(liveGet.generation.available, false)
    assert.equal(liveGet.messages.some((row) => row.text === 'd4-v2-live'), true)
    assert.equal(liveGet.incompleteStream?.state, 'failed')

    const wrap = await listLegacyWrap(owner)
    const wrapGet = await getConversation(owner, wrap.conversation.id, { limit: 50 })
    assert.equal(wrapGet.messages[0].text, 'd4-legacy-first')
    assert.equal(wrapGet.conversation.readOnly, true)
    const versionBefore = wrapGet.timelineVersion

    await assert.rejects(
      getConversation(stranger, live.id),
      (error) => error.statusCode === 404,
    )
    await assert.rejects(
      getConversation(stranger, wrap.conversation.id),
      (error) => error.statusCode === 404,
    )

    const auth = await authorizeConversationSend(mockReq(), {
      userId: owner,
      conversationId: live.id,
      text: 'should not write during recovery',
    })
    assert.equal(auth.status, 503)
    await assert.rejects(
      sendConversationMessage(mockReq(), mockRes(), {
        userId: owner,
        conversationId: live.id,
        text: 'should not write during recovery',
        streamFn: async function* none() {},
      }),
      (error) => error.statusCode === 503,
    )
    const afterMemory = await legacyRowFingerprint(owner)
    assert.deepEqual(afterMemory, beforeMemory)
    const liveCount = await db.query(
      `SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = $1 AND user_id = $2`,
      [live.id, owner],
    )
    assert.equal(liveCount.rows[0].n, 2)

    const restored = await restoreConversation(owner, other.id)
    assert.equal(restored.status, 'active')
    await assert.rejects(
      restoreConversation(owner, wrap.conversation.id),
      (error) => error.statusCode === 403,
    )

    for (let i = 55; i < 58; i += 1) {
      await insertMemory(owner, `d4-catchup-${i}`, new Date(Date.UTC(2024, 4, 3, 0, 1, i)))
    }
    const catchUp = await wrapUserLegacyTimeline(owner, { writesQuiesced: true, batchSize: 40 })
    assert.equal(catchUp.unmappedCount, 0)
    const reconcile = await reconcileUserLegacyWrap(owner)
    assert.equal(reconcile.unmappedCount, 0)
    assert.equal(reconcile.extraDestCount, 0)
    assert.equal(reconcile.orderMismatchCount, 0)

    const wrapAfter = await getConversation(owner, wrap.conversation.id, {
      cursor: wrapGet.nextCursor,
      limit: 50,
      version: versionBefore,
    })
    assert.equal(wrapAfter.stale, true)
    assert.notEqual(wrapAfter.timelineVersion, versionBefore)
    assert.equal(wrapAfter.messages[0].text, 'd4-legacy-first')

    process.env.PARLE_V2_RECOVERY = ''
    assert.equal(isV2GenerationDisabled(), false)
    const reenabled = await authorizeConversationSend(mockReq(), {
      userId: owner,
      conversationId: live.id,
      text: 'resume after recovery',
    })
    assert.equal(reenabled.handled, false)
  } finally {
    if (prevRecovery == null) delete process.env.PARLE_V2_RECOVERY
    else process.env.PARLE_V2_RECOVERY = prevRecovery
  }
})
