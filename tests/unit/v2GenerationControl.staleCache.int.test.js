/**
 * Two local Node processes sharing rehearsal Neon.
 * This is not a Vercel multi-region fleet proof.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { spawn } = require('node:child_process')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../../lib/db')
const {
  createConversation,
  getConversation,
  sendConversationMessage,
  peekRequest,
} = require('../../lib/parle/conversations')
const { authorizeConversationSend } = require('../../lib/parle/conversationSendPolicy')
const { requireAdminUser } = require('../../lib/parle/adminAuth')
const {
  resetGenerationControlCache,
  loadGenerationControl,
  setGenerationControl,
  isV2GenerationBlocked,
} = require('../../lib/parle/v2GenerationControl')

const REHEARSAL_BRANCH = 'br-square-unit-apbswjj3'
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
  const email = emailOverride || `v2f-stale-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-f-stale', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id, email`,
    [email, password, label],
  )
  return inserted.rows[0]
}

async function counts(conversationId, userId) {
  const messages = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_messages WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  const requests = await db.query(
    `SELECT COUNT(*)::int AS n FROM conversation_requests WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  return { messages: messages.rows[0].n, requests: requests.rows[0].n }
}

function spawnCachedInstance() {
  const child = spawn(
    process.execPath,
    [path.join(__dirname, '..', 'helpers', 'v2GenerationControlChild.js')],
    {
      cwd: path.join(__dirname, '..', '..'),
      env: { ...process.env, PARLE_V2_OPS_CONTROL: '1', PARLE_V2_RECOVERY: '' },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
  let out = ''
  child.stdout.on('data', (chunk) => {
    out += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    out += String(chunk)
  })
  return {
    child,
    waitFor(pattern, timeoutMs = 20_000) {
      const started = Date.now()
      return new Promise((resolve, reject) => {
        const tick = () => {
          if (pattern.test(out)) {
            resolve(out)
            return
          }
          if (child.exitCode != null) {
            reject(new Error(`child exited ${child.exitCode}: ${out.slice(-500)}`))
            return
          }
          if (Date.now() - started > timeoutMs) {
            reject(new Error(`timed out waiting for ${pattern}: ${out.slice(-500)}`))
            return
          }
          setTimeout(tick, 25)
        }
        tick()
      })
    },
  }
}

test('stale live cache in another process cannot authorize a new send after read_only', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is not set')
    return
  }
  let ident
  try {
    ident = await db.query(`
      SELECT current_setting('neon.branch_id', true) AS branch_id
    `)
  } catch (error) {
    if (error && error.code === '28P01') {
      t.skip('rehearsal database authentication failed')
      return
    }
    throw error
  }
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    t.skip(`not rehearsal branch ${REHEARSAL_BRANCH}`)
    return
  }
  const table = await db.query(`SELECT to_regclass('public.parle_ops_controls') AS name`)
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
  const adminEmail = `v2f-stale-admin-${STAMP}@parle.chat`
  process.env.ADMIN_EMAILS = adminEmail
  resetGenerationControlCache()

  const owner = await createSynthUser('owner')
  const member = await createSynthUser('member')
  const admin = await createSynthUser('admin', adminEmail)
  const live = await createConversation(owner.id, { modeId: 'cross' })
  let lastRevision = 0

  try {
    assert.equal((await requireAdminUser({ id: member.id })).ok, false)
    assert.equal((await requireAdminUser({ id: admin.id })).ok, true)

    const seeded = await setGenerationControl({
      actorId: admin.id,
      value: 'live',
      confirm: 'LIVE',
      reason: 'stale-cache start live mode',
      expectedRevision: 0,
    }).catch(async (error) => {
      if (error.statusCode !== 409) throw error
      const current = await loadGenerationControl({ force: true })
      return setGenerationControl({
        actorId: admin.id,
        value: 'live',
        confirm: 'LIVE',
        reason: 'stale-cache reset live mode',
        expectedRevision: current.revision,
      })
    })
    lastRevision = seeded.revision

    const sent = await sendConversationMessage(mockReq(), mockRes(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'stale-cache live persist',
      idempotencyKey: `stale-live-${STAMP}`,
      streamFn: async function* ok() {
        yield 'live-ok'
      },
    })
    assert.equal(sent.ok, true)

    const instanceA = spawnCachedInstance()
    await instanceA.waitFor(/^CACHED:live/m)
    const started = Date.now()

    const paused = await setGenerationControl({
      actorId: admin.id,
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'stale-cache pause generation now',
      expectedRevision: lastRevision,
    })
    lastRevision = paused.revision
    assert.equal(paused.value, 'read_only')

    instanceA.child.stdin.write('go\n')
    const childOut = await instanceA.waitFor(/BLOCKED:true/)
    const elapsedMs = Date.now() - started
    assert.match(childOut, /BLOCKED:true/)
    assert.ok(elapsedMs < 8000, `child wait ${elapsedMs}ms must be under the 8s cache TTL`)
    instanceA.child.kill('SIGTERM')

    assert.equal(await isV2GenerationBlocked(), true)

    const before = await counts(live.id, owner.id)
    const auth = await authorizeConversationSend(mockReq(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'stale-cache blocked send',
      idempotencyKey: `stale-block-${STAMP}`,
    })
    assert.equal(auth.status, 503)
    await assert.rejects(
      sendConversationMessage(mockReq(), mockRes(), {
        userId: owner.id,
        conversationId: live.id,
        text: 'stale-cache blocked send',
        idempotencyKey: `stale-block-${STAMP}`,
        streamFn: async function* none() {},
      }),
      (error) => error.statusCode === 503,
    )
    assert.deepEqual(await counts(live.id, owner.id), before)

    const replay = await sendConversationMessage(mockReq(), mockRes(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'stale-cache live persist',
      idempotencyKey: `stale-live-${STAMP}`,
      streamFn: async function* none() {},
    })
    assert.equal(replay.replay, true)
    const got = await getConversation(owner.id, live.id)
    assert.equal(got.messages.length >= 2, true)
    assert.equal(got.generation.available, false)

    const resumed = await setGenerationControl({
      actorId: admin.id,
      value: 'live',
      confirm: 'LIVE',
      reason: 'stale-cache resume generation now',
      expectedRevision: lastRevision,
    })
    lastRevision = resumed.revision
    const afterResume = await sendConversationMessage(mockReq(), mockRes(), {
      userId: owner.id,
      conversationId: live.id,
      text: 'stale-cache resume persist',
      idempotencyKey: `stale-resume-${STAMP}`,
      streamFn: async function* ok() {
        yield 'resume-ok'
      },
    })
    assert.equal(afterResume.ok, true)
    const completed = await peekRequest(owner.id, live.id, `stale-resume-${STAMP}`)
    assert.equal(completed.status, 'completed')
  } finally {
    try {
      const current = await loadGenerationControl({ force: true })
      if (current.value !== 'live') {
        await setGenerationControl({
          actorId: admin.id,
          value: 'live',
          confirm: 'LIVE',
          reason: 'stale-cache restore live after test',
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
