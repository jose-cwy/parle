const test = require('node:test')
const { after } = require('node:test')
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
const { insertChatMessage, listChatMessages } = require('../../lib/chatMemoryDb')
const {
  WRITE_UNAVAILABLE,
  setLegacyWriteBarrier,
  readLegacyWriteStatus,
  assertLegacyWritesAdmitted,
} = require('../../lib/parle/legacyWriteBarrier')
const { CURRENT_REHEARSAL_BRANCH: REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')

const STAMP = Date.now()

async function createSynthUser(label) {
  const email = `v2-barrier-${label}-${STAMP}@parle.test`
  const password = await bcrypt.hash('v2-barrier-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [email, password, label],
  )
  return inserted.rows[0].id
}

async function memoryCount(userId) {
  const result = await db.query(`SELECT COUNT(*)::int AS n FROM chat_memory WHERE user_id = $1`, [userId])
  return result.rows[0].n
}

function spawnChild(mode, userId) {
  const child = spawn(
    process.execPath,
    [path.join(__dirname, '../helpers/legacyWriteBarrierChild.js'), mode],
    {
      cwd: path.join(__dirname, '../..'),
      env: { ...process.env, BARRIER_USER_ID: userId },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
  let out = ''
  child.stdout.on('data', (chunk) => {
    out += chunk
  })
  function waitFor(pattern) {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      const timer = setInterval(() => {
        if (pattern.test(out)) {
          clearInterval(timer)
          resolve(out)
        } else if (Date.now() - start > 20000) {
          clearInterval(timer)
          reject(new Error(`timeout waiting for ${pattern} in ${out}`))
        }
      }, 25)
    })
  }
  return { child, waitFor }
}

test('legacy write barrier freeze, drain, and rehearsal release', async (t) => {
  const ident = await db.query(`
    SELECT current_setting('neon.project_id', true) AS project_id,
           current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    t.skip(`not rehearsal branch ${REHEARSAL_BRANCH}`)
    return
  }
  const table = await db.query(`SELECT to_regclass('public.parle_legacy_write_barrier') AS name`)
  if (!table.rows[0]?.name) {
    t.skip('0011 parle_legacy_write_barrier is not applied')
    return
  }

  const owner = await createSynthUser('owner')
  const importer = await createSynthUser('import')
  const clearer = await createSynthUser('clear')
  const delayed = await createSynthUser('delayed')
  const concurrent = await createSynthUser('concurrent')

  await setLegacyWriteBarrier({ frozen: false, reason: 'test-start-live' })

  try {
    const first = await insertChatMessage(owner, 'user', 'barrier-src-live')
    assert.ok(first?.id)
    assert.equal(await memoryCount(owner), 1)
    const history = await listChatMessages(owner, { limit: 10 })
    assert.equal(history.length, 1)

    const delayedChild = spawnChild('delayed-commit', delayed)
    await delayedChild.waitFor(/LOCKED:live/)

    const freezeStarted = Date.now()
    let freezeDone = false
    const freezePromise = setLegacyWriteBarrier({ frozen: true, reason: 'test-freeze' }).then((row) => {
      freezeDone = true
      return row
    })
    await new Promise((resolve) => setTimeout(resolve, 400))
    assert.equal(freezeDone, false, 'freeze must wait for the admitted FOR SHARE writer')

    delayedChild.child.stdin.write('go\n')
    const delayedOut = await delayedChild.waitFor(/INSERTED:1/)
    assert.match(delayedOut, /INSERTED:1/)
    const frozen = await freezePromise
    assert.equal(Boolean(frozen.frozen), true)
    assert.ok(Date.now() - freezeStarted >= 400)
    assert.equal(await memoryCount(delayed), 1)

    const beforeOwner = await memoryCount(owner)
    await assert.rejects(
      insertChatMessage(owner, 'user', 'barrier-should-reject'),
      (error) => error.statusCode === 503 && error.body.error === WRITE_UNAVAILABLE,
    )
    assert.equal(await memoryCount(owner), beforeOwner)

    await assert.rejects(
      assertLegacyWritesAdmitted(),
      (error) => error.statusCode === 503,
    )
    const status = await readLegacyWriteStatus()
    assert.equal(status.writable, false)

    const beforeImport = await memoryCount(importer)
    await assert.rejects(
      insertChatMessage(importer, 'user', 'import-during-freeze'),
      (error) => error.statusCode === 503 && error.body.error === WRITE_UNAVAILABLE,
    )
    assert.equal(await memoryCount(importer), beforeImport)

    const { withLegacyMutation } = require('../../lib/parle/legacyWriteBarrier')
    await assert.rejects(
      withLegacyMutation((client) =>
        client.query('DELETE FROM chat_memory WHERE user_id=$1', [clearer]),
      ),
      (error) => error.statusCode === 503,
    )

    const conc = spawnChild('insert', concurrent)
    const concOut = await conc.waitFor(/INSERTED:0/)
    assert.match(concOut, /history_save_in_progress/)
    assert.equal(await memoryCount(concurrent), 0)

    const listedDuring = await listChatMessages(owner, { limit: 20 })
    assert.equal(listedDuring.length, beforeOwner)
    assert.equal(listedDuring[0].text, 'barrier-src-live')

    await setLegacyWriteBarrier({ frozen: false, reason: 'test-release' })
    const released = await insertChatMessage(owner, 'assistant', 'barrier-src-after-release')
    assert.ok(released?.id)
    assert.equal(await memoryCount(owner), beforeOwner + 1)
    assert.equal((await readLegacyWriteStatus()).writable, true)
  } finally {
    await setLegacyWriteBarrier({ frozen: false, reason: 'test-cleanup' }).catch(() => {})
  }
})

test('0012 trigger blocks uninstrumented SQL when frozen and admits live writes', async (t) => {
  const ident = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    t.skip(`not rehearsal branch ${REHEARSAL_BRANCH}`)
    return
  }
  const trigger = await db.query(`
    SELECT tgname FROM pg_trigger
    WHERE tgname = 'trg_chat_memory_legacy_write_barrier' AND NOT tgisinternal
  `)
  if (!trigger.rows[0]) {
    t.skip('0012 chat_memory write guard is not applied')
    return
  }

  const owner = await createSynthUser('guard')
  await setLegacyWriteBarrier({ frozen: false, reason: 'test-guard-live' })
  try {
    await db.query(
      `INSERT INTO chat_memory (user_id, role, text, created_at) VALUES ($1, 'user', 'live-raw', now())`,
      [owner],
    )
    assert.equal(await memoryCount(owner), 1)

    await setLegacyWriteBarrier({ frozen: true, reason: 'test-guard-freeze' })
    await assert.rejects(
      db.query(
        `INSERT INTO chat_memory (user_id, role, text, created_at) VALUES ($1, 'user', 'frozen-raw', now())`,
        [owner],
      ),
      (error) => error.code === 'P0001' && String(error.message).includes(WRITE_UNAVAILABLE),
    )
    await assert.rejects(
      db.query(`DELETE FROM chat_memory WHERE user_id = $1`, [owner]),
      (error) => error.code === 'P0001',
    )
    assert.equal(await memoryCount(owner), 1)
    const listed = await listChatMessages(owner, { limit: 10 })
    assert.equal(listed.length, 1)
  } finally {
    await setLegacyWriteBarrier({ frozen: false, reason: 'test-cleanup' }).catch(() => {})
  }
})

test('interrupted assistant persist keeps the user row for wrap-copy', async (t) => {
  const ident = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    t.skip(`not rehearsal branch ${REHEARSAL_BRANCH}`)
    return
  }
  const table = await db.query(`SELECT to_regclass('public.parle_legacy_write_barrier') AS name`)
  if (!table.rows[0]?.name) {
    t.skip('0011 parle_legacy_write_barrier is not applied')
    return
  }

  const { wrapUserLegacyTimeline } = require('../../lib/parle/legacyWrapCopy')
  const owner = await createSynthUser('interrupted')
  await setLegacyWriteBarrier({ frozen: false, reason: 'test-interrupted-live' })
  try {
    const userRow = await insertChatMessage(owner, 'user', 'interrupted-user-src')
    assert.ok(userRow?.id)
    await setLegacyWriteBarrier({ frozen: true, reason: 'test-interrupted-freeze' })
    await assert.rejects(
      insertChatMessage(owner, 'assistant', 'interrupted-assistant-must-not-land'),
      (error) => error.statusCode === 503 && error.body.error === WRITE_UNAVAILABLE,
    )
    assert.equal(await memoryCount(owner), 1)
    const history = await listChatMessages(owner, { limit: 10 })
    assert.equal(history[0].role, 'user')
    assert.equal(history[0].text, 'interrupted-user-src')

    const wrap = await wrapUserLegacyTimeline(owner, { writesQuiesced: true, batchSize: 40 })
    assert.equal(wrap.sourceCount, 1)
    assert.equal(wrap.mappedCount, 1)
    const dest = await db.query(
      `SELECT role FROM conversation_messages WHERE conversation_id = $1 AND user_id = $2`,
      [wrap.wrapId, owner],
    )
    assert.equal(dest.rows.length, 1)
    assert.equal(dest.rows[0].role, 'user')
  } finally {
    await setLegacyWriteBarrier({ frozen: false, reason: 'test-cleanup' }).catch(() => {})
  }
})

after(async () => {
  await db.pool.end().catch(() => {})
})
