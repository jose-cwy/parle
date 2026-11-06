const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../../lib/db')
const { insertChatMessage } = require('../../lib/chatMemoryDb')
const { PREFIX } = require('../../lib/security/encryption')
const {
  createConversation,
  restoreConversation,
  sendConversationMessage,
} = require('../../lib/parle/conversations')
const { authorizeConversationSend } = require('../../lib/parle/conversationSendPolicy')
const {
  WRAP_TITLE,
  WRAP_IMPORT_KEY,
  wrapUserLegacyTimeline,
  reconcileUserLegacyWrap,
  legacyRowFingerprint,
  othersFingerprint,
} = require('../../lib/parle/legacyWrapCopy')

const { CURRENT_REHEARSAL_BRANCH: REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')
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
  }
}

async function createSynthUser(label) {
  const email = `v2d-wrap-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-d-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [email, password, label],
  )
  return inserted.rows[0].id
}

async function seedLegacy(userId, rows) {
  const ids = []
  for (const row of rows) {
    const inserted = await insertChatMessage(userId, row.role, row.text, row.createdAt)
    ids.push(inserted.id)
  }
  return ids
}

test('V2-D.1–D.2 synthetic wrap-copy, constraints, idempotency, and recovery', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is not set')
    return
  }

  const ident = await db.query(`
    SELECT current_setting('neon.project_id', true) AS project_id,
           current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    t.skip(`not rehearsal branch ${REHEARSAL_BRANCH}`)
    return
  }

  const tables = await db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('user_chat_migration', 'conversation_legacy_map')
    ORDER BY table_name
  `)
  assert.deepEqual(
    tables.rows.map((row) => row.table_name),
    ['conversation_legacy_map', 'user_chat_migration'],
  )

  const owner = await createSynthUser('owner')
  const other = await createSynthUser('other')
  const raceUser = await createSynthUser('race')
  const lateUser = await createSynthUser('late')
  const synthIds = [owner, other, raceUser, lateUser]
  const othersBefore = await othersFingerprint(synthIds)

  const t0 = new Date('2024-01-01T00:00:00.000Z')
  const t1 = new Date('2024-01-01T00:00:01.000Z')
  const t2 = new Date('2024-01-01T00:00:02.000Z')
  const ownerIds = await seedLegacy(owner, [
    { role: 'user', text: 'wrap-src-a', createdAt: t0 },
    { role: 'assistant', text: 'wrap-src-b', createdAt: t1 },
    { role: 'user', text: 'wrap-src-c', createdAt: t2 },
    { role: 'assistant', text: 'wrap-src-d', createdAt: t2 },
  ])
  await seedLegacy(other, [
    { role: 'user', text: 'other-src-only', createdAt: t0 },
  ])
  const ownerBefore = await legacyRowFingerprint(owner)

  const first = await wrapUserLegacyTimeline(owner, { batchSize: 50, writesQuiesced: false })
  assert.equal(first.branchId, REHEARSAL_BRANCH)
  assert.equal(first.state, 'pending_quiesce')
  assert.equal(first.complete, true)
  assert.equal(first.sourceCount, 4)
  assert.equal(first.mappedCount, 4)
  assert.equal(first.unmappedCount, 0)
  assert.equal(first.extraDestCount, 0)
  assert.equal(first.ciphertextMatchCount, 4)
  assert.equal(first.timestampMatchCount, 4)
  assert.equal(first.orderMismatchCount, 0)
  assert.equal(first.ownerMismatchCount, 0)
  assert.equal(first.wrapCount, 1)
  assert.equal(first.wrapOrigin, 'legacy_timeline')
  assert.equal(first.wrapStatus, 'archived')
  assert.equal(first.wrapImportKey, WRAP_IMPORT_KEY)

  const wrapRow = await db.query(
    `SELECT title_enc, origin, status FROM conversations WHERE id = $1 AND user_id = $2`,
    [first.wrapId, owner],
  )
  const { decrypt } = require('../../lib/security/encryption')
  assert.equal(decrypt(wrapRow.rows[0].title_enc), WRAP_TITLE)

  const dest = await db.query(
    `SELECT text_enc FROM conversation_messages
     WHERE conversation_id = $1 AND user_id = $2
     ORDER BY seq ASC`,
    [first.wrapId, owner],
  )
  assert.equal(dest.rows.every((row) => String(row.text_enc).startsWith(PREFIX)), true)

  const second = await wrapUserLegacyTimeline(owner, { writesQuiesced: true })
  assert.equal(second.state, 'migrated')
  assert.equal(second.copiedThisRun, 0)
  assert.equal(second.mappedCount, 4)
  assert.equal(second.wrapCount, 1)

  const ownerAfter = await legacyRowFingerprint(owner)
  assert.deepEqual(ownerAfter, ownerBefore)

  const otherMap = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_legacy_map WHERE user_id = $1`,
    [other],
  )
  assert.equal(otherMap.rows[0].n, 0)

  const cross = await db.query(
    `SELECT COUNT(*)::int AS n
     FROM conversation_legacy_map map
     JOIN chat_memory m ON m.id = map.chat_memory_id
     WHERE map.user_id = $1 AND m.user_id <> map.user_id`,
    [owner],
  )
  assert.equal(cross.rows[0].n, 0)

  const existingMapMsg = await db.query(
    `SELECT conversation_message_id FROM conversation_legacy_map
     WHERE user_id = $1 AND chat_memory_id = $2`,
    [owner, ownerIds[0]],
  )
  await assert.rejects(
    db.query(
      `INSERT INTO conversation_legacy_map
        (user_id, chat_memory_id, conversation_id, conversation_message_id)
       VALUES ($1, $2, $3, $4)`,
      [owner, ownerIds[0], first.wrapId, existingMapMsg.rows[0].conversation_message_id],
    ),
    (error) => error && error.code === '23505',
  )

  const extraSource = await insertChatMessage(owner, 'user', 'wrap-src-extra', t0)
  const live = await createConversation(owner, { origin: 'live' })
  const liveMsg = await db.query(
    `INSERT INTO conversation_messages
      (conversation_id, user_id, role, seq, text_enc, created_at)
     VALUES ($1, $2, 'user', 1, $3, now())
     RETURNING id`,
    [live.id, owner, `${PREFIX}not-a-wrap`],
  )
  await assert.rejects(
    db.query(
      `INSERT INTO conversation_legacy_map
        (user_id, chat_memory_id, conversation_id, conversation_message_id)
       VALUES ($1, $2, $3, $4)`,
      [owner, extraSource.id, live.id, liveMsg.rows[0].id],
    ),
  )

  const otherLegacy = await db.query(
    `SELECT id FROM chat_memory WHERE user_id = $1 LIMIT 1`,
    [other],
  )
  const dummySeq = await db.query(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS seq
     FROM conversation_messages WHERE conversation_id = $1`,
    [first.wrapId],
  )
  const dummyDest = await db.query(
    `INSERT INTO conversation_messages
      (conversation_id, user_id, role, seq, text_enc, created_at)
     VALUES ($1, $2, 'user', $3, $4, now())
     RETURNING id`,
    [first.wrapId, owner, dummySeq.rows[0].seq, `${PREFIX}dummy-owner-row`],
  )
  await assert.rejects(
    db.query(
      `INSERT INTO conversation_legacy_map
        (user_id, chat_memory_id, conversation_id, conversation_message_id)
       VALUES ($1, $2, $3, $4)`,
      [owner, otherLegacy.rows[0].id, first.wrapId, dummyDest.rows[0].id],
    ),
  )

  await assert.rejects(
    restoreConversation(owner, first.wrapId),
    (error) => error && error.statusCode === 403 && error.body?.error === 'read_only_history',
  )

  const sendAuth = await authorizeConversationSend(mockReq(), {
    userId: owner,
    conversationId: first.wrapId,
    text: 'should not send',
  })
  assert.equal(sendAuth.handled, true)
  assert.equal(sendAuth.status, 403)
  assert.equal(sendAuth.body.error, 'read_only_history')

  await assert.rejects(
    sendConversationMessage(mockReq(), mockRes(), {
      userId: owner,
      conversationId: first.wrapId,
      text: 'should not send',
      streamFn: async function* none() {},
    }),
    (error) => error && (error.statusCode === 403 || error.statusCode === 404),
  )

  const interruptUser = await createSynthUser('interrupt')
  synthIds.push(interruptUser)
  await seedLegacy(interruptUser, [
    { role: 'user', text: 'int-1', createdAt: t0 },
    { role: 'assistant', text: 'int-2', createdAt: t1 },
    { role: 'user', text: 'int-3', createdAt: t2 },
    { role: 'assistant', text: 'int-4', createdAt: new Date('2024-01-01T00:00:03.000Z') },
  ])
  const partial = await wrapUserLegacyTimeline(interruptUser, {
    batchSize: 2,
    maxBatches: 1,
    writesQuiesced: false,
  })
  assert.equal(partial.state, 'migrating')
  assert.equal(partial.mappedCount, 2)
  assert.equal(partial.unmappedCount, 2)

  await assert.rejects(
    wrapUserLegacyTimeline(interruptUser, {
      batchSize: 2,
      failBeforeCommit: true,
    }),
    (error) => error && error.message === 'injected_txn_failure',
  )
  const afterFail = await reconcileUserLegacyWrap(interruptUser)
  assert.equal(afterFail.mappedCount, 2)
  const interrupted = await db.query(
    `SELECT state FROM user_chat_migration WHERE user_id = $1`,
    [interruptUser],
  )
  assert.equal(interrupted.rows[0].state, 'interrupted')

  const resumed = await wrapUserLegacyTimeline(interruptUser, { writesQuiesced: true })
  assert.equal(resumed.complete, true)
  assert.equal(resumed.mappedCount, 4)
  assert.equal(resumed.state, 'migrated')
  assert.equal(resumed.copiedThisRun, 2)

  await seedLegacy(raceUser, [
    { role: 'user', text: 'race-a', createdAt: t0 },
    { role: 'assistant', text: 'race-b', createdAt: t1 },
  ])
  const concurrent = await Promise.all([
    wrapUserLegacyTimeline(raceUser, { writesQuiesced: true }),
    wrapUserLegacyTimeline(raceUser, { writesQuiesced: true }),
  ])
  const race = await reconcileUserLegacyWrap(raceUser)
  assert.equal(race.mappedCount, 2)
  assert.equal(race.wrapCount, 1)
  assert.equal(race.extraDestCount, 0)
  assert.equal(concurrent.every((item) => item.mappedCount === 2), true)

  await seedLegacy(lateUser, [
    { role: 'user', text: 'late-committed', createdAt: new Date('2024-02-01T00:00:00.000Z') },
  ])
  const hold = await db.pool.connect()
  try {
    await hold.query('BEGIN')
    await hold.query(
      `INSERT INTO chat_memory (user_id, role, text, training_content, created_at)
       VALUES ($1, 'user', $2, $2, $3)`,
      [lateUser, `${PREFIX}held-earlier-row`, new Date('2024-01-15T00:00:00.000Z')],
    )
    const mid = await wrapUserLegacyTimeline(lateUser, { writesQuiesced: false })
    assert.equal(mid.mappedCount, 1)
    assert.equal(mid.unmappedCount, 0)
    assert.equal(mid.state, 'pending_quiesce')
    await hold.query('COMMIT')
  } finally {
    hold.release()
  }
  const afterLate = await wrapUserLegacyTimeline(lateUser, { writesQuiesced: true })
  assert.equal(afterLate.sourceCount, 2)
  assert.equal(afterLate.mappedCount, 2)
  assert.equal(afterLate.orderMismatchCount, 0)
  assert.equal(
    afterLate.complete,
    true,
    `late wrap incomplete unmapped=${afterLate.unmappedCount} extra=${afterLate.extraDestCount} cipher=${afterLate.ciphertextMatchCount} ts=${afterLate.timestampMatchCount} order=${afterLate.orderMismatchCount} wraps=${afterLate.wrapCount}`,
  )

  const concurrentWriter = await createSynthUser('writer')
  synthIds.push(concurrentWriter)
  await seedLegacy(concurrentWriter, [
    { role: 'user', text: 'cw-1', createdAt: t0 },
  ])
  let insertedDuring = false
  const during = wrapUserLegacyTimeline(concurrentWriter, {
    batchSize: 1,
    writesQuiesced: false,
    onAfterBatch: async () => {
      if (insertedDuring) return
      insertedDuring = true
      await insertChatMessage(concurrentWriter, 'assistant', 'cw-2', t1)
    },
  })
  const duringResult = await during
  assert.notEqual(duringResult.state, 'migrated')
  const writerFinal = await wrapUserLegacyTimeline(concurrentWriter, { writesQuiesced: true })
  assert.equal(writerFinal.mappedCount, writerFinal.sourceCount)
  assert.equal(writerFinal.state, 'migrated')

  const othersAfter = await othersFingerprint(synthIds)
  assert.deepEqual(othersAfter, othersBefore)

  const mixedV2 = await db.query(
    `SELECT COUNT(*)::int AS n
     FROM conversations
     WHERE origin = 'live'`
  )
  assert.equal(typeof mixedV2.rows[0].n, 'number')
})
