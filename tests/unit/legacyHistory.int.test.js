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
const { wrapUserLegacyTimeline, legacyRowFingerprint } = require('../../lib/parle/legacyWrapCopy')
const { decodeLegacyCursor } = require('../../lib/parle/legacyCursor')

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
  const email = `v2d3-hist-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-d3-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [email, password, label],
  )
  return inserted.rows[0].id
}

test('V2-D.3 wrap pagination, isolation, and read-only enforcement', async (t) => {
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

  const owner = await createSynthUser('owner')
  const stranger = await createSynthUser('stranger')
  const none = await createSynthUser('none')

  await db.query(
    `INSERT INTO chat_memory (user_id, role, text, training_content, created_at)
     VALUES ($1, 'user', $2, $2, $3), ($1, 'assistant', $4, $4, $5)`,
    [
      owner,
      encrypt('d3-keep-a'),
      new Date('2024-01-01T00:00:00.000Z'),
      encrypt('d3-keep-b'),
      new Date('2024-01-01T00:00:01.000Z'),
    ],
  )
  const before = await legacyRowFingerprint(owner)
  await wrapUserLegacyTimeline(owner, { writesQuiesced: true })

  const total = 220
  const wrapRow = await db.query(
    `SELECT id FROM conversations WHERE user_id = $1 AND origin = 'legacy_timeline'`,
    [owner],
  )
  const wrapId = wrapRow.rows[0].id
  for (let start = 2; start < total; start += 40) {
    const end = Math.min(total, start + 40)
    const params = []
    const values = []
    for (let i = start; i < end; i += 1) {
      const offset = params.length
      values.push(`($${offset + 1}::uuid, $${offset + 2}::uuid, $${offset + 3}, $${offset + 4}::bigint, $${offset + 5}, $${offset + 6}::timestamptz)`)
      const text = `d3-src-${String(i).padStart(3, '0')}`
      params.push(
        wrapId,
        owner,
        i % 2 === 0 ? 'user' : 'assistant',
        i + 1,
        encrypt(text),
        new Date(Date.UTC(2024, 0, 1, 0, 0, i)),
      )
    }
    await db.query(
      `INSERT INTO conversation_messages (conversation_id, user_id, role, seq, text_enc, created_at)
       VALUES ${values.join(',')}`,
      params,
    )
  }
  await db.query(
    `UPDATE conversation_messages
     SET text_enc = $3, created_at = $4
     WHERE conversation_id = $1 AND user_id = $2 AND seq = 1`,
    [wrapId, owner, encrypt('d3-src-000'), new Date(Date.UTC(2024, 0, 1, 0, 0, 0))],
  )
  await db.query(
    `UPDATE conversation_messages
     SET text_enc = $3, created_at = $4
     WHERE conversation_id = $1 AND user_id = $2 AND seq = 2`,
    [wrapId, owner, encrypt('d3-src-001'), new Date(Date.UTC(2024, 0, 1, 0, 0, 1))],
  )
  await db.query(
    `UPDATE user_chat_migration SET mapped_count = $2, updated_at = now() WHERE user_id = $1`,
    [owner, total],
  )

  const listed = await listConversations(owner)
  assert.equal(listed.every((row) => row.origin !== 'legacy_timeline'), true)
  const archived = await listConversations(owner, { status: 'archived' })
  assert.equal(archived.every((row) => row.origin !== 'legacy_timeline'), true)

  const absent = await listLegacyWrap(none)
  assert.equal(absent.conversation, null)
  assert.equal(absent.migration.state, 'absent')

  const wrap = await listLegacyWrap(owner)
  assert.equal(Boolean(wrap.conversation?.id), true)
  assert.equal(wrap.conversation.origin, 'legacy_timeline')
  assert.equal(wrap.conversation.readOnly, true)
  assert.equal(wrap.migration.complete, true)

  const destCount = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = $1 AND user_id = $2`,
    [wrap.conversation.id, owner],
  )
  assert.equal(destCount.rows[0].n, total)

  const first = await getConversation(owner, wrap.conversation.id, { limit: 50 })
  assert.equal(first.messages.length, 50)
  assert.equal(first.hasMore, true)
  assert.equal(first.messages[0].text, 'd3-src-000')
  assert.equal(first.messages[49].text, 'd3-src-049')
  assert.equal(first.migration.complete, true)
  assert.equal(Boolean(first.nextCursor), true)

  const decoded = decodeLegacyCursor(first.nextCursor)
  assert.equal(decoded.id, first.messages[49].id)
  assert.equal(decoded.position, 50)
  const second = await getConversation(owner, wrap.conversation.id, {
    cursor: first.nextCursor,
    limit: 50,
    version: first.timelineVersion,
  })
  assert.equal(second.stale, false)
  assert.equal(second.messages.length, 50)
  assert.equal(second.messages[0].text, 'd3-src-050')
  const overlap = first.messages.filter((row) => second.messages.some((other) => other.id === row.id))
  assert.equal(overlap.length, 0)

  let cursor = second.nextCursor
  let version = second.timelineVersion
  let seen = first.messages.length + second.messages.length
  while (cursor) {
    const page = await getConversation(owner, wrap.conversation.id, {
      cursor,
      limit: 50,
      version,
    })
    seen += page.messages.length
    cursor = page.hasMore ? page.nextCursor : null
    version = page.timelineVersion
    if (!page.hasMore) break
  }
  assert.equal(seen, total)

  await assert.rejects(
    getConversation(owner, wrap.conversation.id, { cursor: 'not-valid' }),
    (error) => error.statusCode === 400 && error.body?.error === 'invalid_cursor',
  )

  await assert.rejects(
    getConversation(stranger, wrap.conversation.id),
    (error) => error.statusCode === 404,
  )
  const strangerLegacy = await listLegacyWrap(stranger)
  assert.equal(strangerLegacy.conversation, null)

  const auth = await authorizeConversationSend(mockReq(), {
    userId: owner,
    conversationId: wrap.conversation.id,
    text: 'should not send',
  })
  assert.equal(auth.status, 403)
  await assert.rejects(
    sendConversationMessage(mockReq(), mockRes(), {
      userId: owner,
      conversationId: wrap.conversation.id,
      text: 'should not send',
      streamFn: async function* none() {},
    }),
    (error) => error.statusCode === 403 || error.statusCode === 404,
  )
  await assert.rejects(
    restoreConversation(owner, wrap.conversation.id),
    (error) => error.statusCode === 403,
  )
  await assert.rejects(
    archiveConversation(owner, wrap.conversation.id),
    (error) => error.statusCode === 403 || error.statusCode === 404,
  )

  const live = await createConversation(owner)
  const liveGet = await getConversation(owner, live.id)
  assert.notEqual(liveGet.conversation.origin, 'legacy_timeline')

  const after = await legacyRowFingerprint(owner)
  assert.deepEqual(after, before)
})
