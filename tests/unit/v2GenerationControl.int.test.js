const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../../lib/db')
const {
  createConversation,
  listConversations,
  listLegacyWrap,
  getConversation,
  archiveConversation,
  restoreConversation,
  sendConversationMessage,
  peekRequest,
} = require('../../lib/parle/conversations')
const { authorizeConversationSend } = require('../../lib/parle/conversationSendPolicy')
const { wrapUserLegacyTimeline } = require('../../lib/parle/legacyWrapCopy')
const { encrypt } = require('../../lib/security/encryption')
const {
  isOpsControlExposed,
  resetGenerationControlCache,
  loadGenerationControl,
  setGenerationControl,
} = require('../../lib/parle/v2GenerationControl')
const { requireAdminUser } = require('../../lib/parle/adminAuth')

const { CURRENT_REHEARSAL_BRANCH: REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')
const STAMP = Date.now()

function mockReq() {
  return {
    aborted: false,
    once() {},
    off() {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  }
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

async function createSynthUser(label, emailOverride) {
  const email = emailOverride || `v2f-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-f-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [email, password, label],
  )
  return { id: inserted.rows[0].id, email }
}

async function insertMemory(userId, text, at) {
  await db.query(
    `INSERT INTO chat_memory (user_id, role, text, training_content, created_at)
     VALUES ($1, 'user', $2, $2, $3)`,
    [userId, encrypt(text), at],
  )
}

async function messageCount(conversationId, userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  return result.rows[0].n
}

async function requestCount(conversationId, userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_requests WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  return result.rows[0].n
}

test('V2-F generation control live, read_only, sticky failure, concurrency, in-flight, re-enable', async (t) => {
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
  const table = await db.query(`
    SELECT to_regclass('public.parle_ops_controls') AS name
  `)
  if (!table.rows[0]?.name) {
    t.skip('0010 parle_ops_controls is not applied')
    return
  }

  const prevOps = process.env.PARLE_V2_OPS_CONTROL
  const prevAdmin = process.env.ADMIN_EMAILS
  const prevSkip = process.env.PARLE_V2_SKIP_DAILY
  const prevRecovery = process.env.PARLE_V2_RECOVERY
  process.env.PARLE_V2_OPS_CONTROL = '1'
  process.env.PARLE_V2_SKIP_DAILY = '1'
  process.env.PARLE_V2_RECOVERY = ''
  const adminEmail = `v2f-admin-${STAMP}@parle.chat`
  process.env.ADMIN_EMAILS = adminEmail
  resetGenerationControlCache()

  const owner = await createSynthUser('owner')
  const member = await createSynthUser('member')
  const admin = await createSynthUser('admin', adminEmail)
  const live = await createConversation(owner.id, { modeId: 'cross' })
  await insertMemory(owner.id, 'v2f-legacy-row', new Date(Date.UTC(2024, 5, 1)))
  const wrap = await wrapUserLegacyTimeline(owner.id, { writesQuiesced: true, batchSize: 40 })

  let lastRevision = 0
  try {
    const adminGate = await requireAdminUser({ id: admin.id })
    assert.equal(adminGate.ok, true)
    const memberGate = await requireAdminUser({ id: member.id })
    assert.equal(memberGate.ok, false)
    assert.equal(memberGate.status, 404)
    assert.equal(isOpsControlExposed(), true)

    const seeded = await setGenerationControl({
      actorId: admin.id,
      value: 'live',
      confirm: 'LIVE',
      reason: 'start rehearsal live mode',
      expectedRevision: 0,
    }).catch(async (error) => {
      if (error.statusCode !== 409) throw error
      const current = await loadGenerationControl({ force: true })
      return setGenerationControl({
        actorId: admin.id,
        value: 'live',
        confirm: 'LIVE',
        reason: 'reset rehearsal live mode',
        expectedRevision: current.revision,
      })
    })
    assert.equal(seeded.value, 'live')
    lastRevision = seeded.revision

    const sent = await sendConversationMessage(mockReq(), mockRes(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'live mode should persist',
      idempotencyKey: `v2f-live-${STAMP}`,
      streamFn: async function* ok() {
        yield 'live-reply'
      },
    })
    assert.equal(sent.ok, true)
    const afterLive = await messageCount(live.id, owner.id)
    assert.equal(afterLive, 2)
    const completed = await peekRequest(owner.id, live.id, `v2f-live-${STAMP}`)
    assert.equal(completed.status, 'completed')

    const paused = await setGenerationControl({
      actorId: admin.id,
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'pause generation for rehearsal',
      expectedRevision: lastRevision,
    })
    assert.equal(paused.value, 'read_only')
    lastRevision = paused.revision

    const audit = await db.query(
      `SELECT new_value, reason, actor_id FROM parle_ops_control_audit
       WHERE key = 'v2_generation' AND revision = $1`,
      [lastRevision],
    )
    assert.equal(audit.rows[0].new_value, 'read_only')
    assert.equal(audit.rows[0].actor_id, admin.id)

    const auth = await authorizeConversationSend(mockReq(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'blocked while read_only',
      idempotencyKey: `v2f-block-${STAMP}`,
    })
    assert.equal(auth.status, 503)
    assert.equal(auth.body.error, 'generation_unavailable')

    const beforeBlockMessages = await messageCount(live.id, owner.id)
    const beforeBlockRequests = await requestCount(live.id, owner.id)
    await assert.rejects(
      sendConversationMessage(mockReq(), mockRes(), {
        userId: owner.id,
        conversationId: live.id,
        text: 'blocked while read_only',
        idempotencyKey: `v2f-block-${STAMP}`,
        streamFn: async function* none() {},
      }),
      (error) => error.statusCode === 503,
    )
    assert.equal(await messageCount(live.id, owner.id), beforeBlockMessages)
    assert.equal(await requestCount(live.id, owner.id), beforeBlockRequests)

    const replay = await sendConversationMessage(mockReq(), mockRes(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'live mode should persist',
      idempotencyKey: `v2f-live-${STAMP}`,
      streamFn: async function* none() {},
    })
    assert.equal(replay.replay, true)
    assert.equal(await messageCount(live.id, owner.id), beforeBlockMessages)

    const listed = await listConversations(owner.id)
    assert.equal(listed.some((row) => row.id === live.id), true)
    const got = await getConversation(owner.id, live.id)
    assert.equal(got.generation.available, false)
    assert.equal(got.messages.length, 2)
    const archived = await archiveConversation(owner.id, live.id)
    assert.equal(archived.status, 'archived')
    const hidden = await listConversations(owner.id, { status: 'archived' })
    assert.equal(hidden.some((row) => row.id === live.id), true)
    const restored = await restoreConversation(owner.id, live.id)
    assert.equal(restored.status, 'active')
    const legacy = await listLegacyWrap(owner.id)
    assert.equal(legacy.conversation.id, wrap.wrapId)
    const legacyGet = await getConversation(owner.id, wrap.wrapId)
    assert.equal(legacyGet.messages.some((row) => row.text === 'v2f-legacy-row'), true)

    const failingQuery = async (sql, params) => {
      if (String(sql).includes('FROM parle_ops_controls')) {
        throw Object.assign(new Error('injected read failure'), { code: '57P01' })
      }
      return db.query(sql, params)
    }
    const sticky = await loadGenerationControl({
      force: true,
      query: failingQuery,
    })
    assert.equal(sticky.value, 'read_only')
    assert.equal(sticky.source, 'sticky_error')

    const concurrent = await Promise.allSettled([
      setGenerationControl({
        actorId: admin.id,
        value: 'live',
        confirm: 'LIVE',
        reason: 'conflict winner resume now',
        expectedRevision: lastRevision,
      }),
      setGenerationControl({
        actorId: admin.id,
        value: 'live',
        confirm: 'LIVE',
        reason: 'conflict loser resume now',
        expectedRevision: lastRevision,
      }),
    ])
    const won = concurrent.filter((item) => item.status === 'fulfilled')
    const lost = concurrent.filter((item) => item.status === 'rejected')
    assert.equal(won.length, 1)
    assert.equal(lost.length, 1)
    assert.equal(lost[0].reason.statusCode, 409)
    lastRevision = won[0].value.revision

    const pausedAgain = await setGenerationControl({
      actorId: admin.id,
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'pause again for in-flight boundary',
      expectedRevision: lastRevision,
    }).catch(async (error) => {
      if (error.statusCode !== 409) throw error
      const current = await loadGenerationControl({ force: true })
      return setGenerationControl({
        actorId: admin.id,
        value: 'read_only',
        confirm: 'READ_ONLY',
        reason: 'pause again for in-flight boundary',
        expectedRevision: current.revision,
      })
    })
    lastRevision = pausedAgain.revision
    const liveAgain = await setGenerationControl({
      actorId: admin.id,
      value: 'live',
      confirm: 'LIVE',
      reason: 'resume for in-flight start',
      expectedRevision: lastRevision,
    })
    lastRevision = liveAgain.revision
    assert.equal(liveAgain.value, 'live')

    let released
    const hangReady = new Promise((resolve) => {
      released = resolve
    })
    const hang = sendConversationMessage(mockReq(), mockRes(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'in-flight should finish after switch',
      idempotencyKey: `v2f-hang-${STAMP}`,
      streamFn: async function* hanging() {
        yield 'partial-inflight'
        await hangReady
        yield '-done'
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 80))
    const during = await setGenerationControl({
      actorId: admin.id,
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'switch during in-flight stream',
      expectedRevision: lastRevision,
    })
    lastRevision = during.revision
    await assert.rejects(
      sendConversationMessage(mockReq(), mockRes(), {
        userId: owner.id,
        conversationId: live.id,
        text: 'new send after switch',
        idempotencyKey: `v2f-after-hang-${STAMP}`,
        streamFn: async function* none() {},
      }),
      (error) => error.statusCode === 503,
    )
    released()
    const inFlight = await hang
    assert.equal(inFlight.ok, true)
    const afterHang = await getConversation(owner.id, live.id)
    assert.equal(
      afterHang.messages.some((row) => row.text === 'partial-inflight-done'),
      true,
    )

    const resumed = await setGenerationControl({
      actorId: admin.id,
      value: 'live',
      confirm: 'LIVE',
      reason: 'resume generation after rehearsal',
      expectedRevision: lastRevision,
    })
    assert.equal(resumed.value, 'live')
    lastRevision = resumed.revision
    const verified = await loadGenerationControl({ force: true })
    assert.equal(verified.value, 'live')
    const afterResume = await sendConversationMessage(mockReq(), mockRes(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'resume should persist',
      idempotencyKey: `v2f-resume-${STAMP}`,
      streamFn: async function* ok() {
        yield 'resumed-reply'
      },
    })
    assert.equal(afterResume.ok, true)
    const listedAfter = await listConversations(owner.id)
    assert.equal(listedAfter.some((row) => row.id === live.id), true)
  } finally {
    try {
      const current = await loadGenerationControl({ force: true })
      if (current.value !== 'live') {
        await setGenerationControl({
          actorId: admin.id,
          value: 'live',
          confirm: 'LIVE',
          reason: 'restore live after V2-F test',
          expectedRevision: current.revision,
        })
      }
    } catch {
      /* keep going */
    }
    if (prevOps == null) delete process.env.PARLE_V2_OPS_CONTROL
    else process.env.PARLE_V2_OPS_CONTROL = prevOps
    if (prevAdmin == null) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = prevAdmin
    if (prevSkip == null) delete process.env.PARLE_V2_SKIP_DAILY
    else process.env.PARLE_V2_SKIP_DAILY = prevSkip
    if (prevRecovery == null) delete process.env.PARLE_V2_RECOVERY
    else process.env.PARLE_V2_RECOVERY = prevRecovery
    resetGenerationControlCache()
  }
})
