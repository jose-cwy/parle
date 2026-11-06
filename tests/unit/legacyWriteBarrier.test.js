const test = require('node:test')
const assert = require('node:assert/strict')
const {
  WRITE_UNAVAILABLE,
  BARRIER_RECOVERY_INVARIANT,
  isBarrierTriggerError,
  barrierUnavailableError,
  withLegacyMutation,
  assertLegacyWritesAdmitted,
  readLegacyWriteStatus,
} = require('../../lib/parle/legacyWriteBarrier')

test('barrier errors are retryable 503s', () => {
  const error = barrierUnavailableError('frozen')
  assert.equal(error.statusCode, 503)
  assert.equal(error.retryable, true)
  assert.equal(error.body.error, WRITE_UNAVAILABLE)
  assert.equal(error.body.retryable, true)
})

test('missing barrier table stays writable', async () => {
  const query = async (sql) => {
    if (String(sql).includes('to_regclass')) return { rows: [{ name: null }] }
    throw new Error('should not read barrier row')
  }
  const status = await readLegacyWriteStatus({ query })
  assert.equal(status.writable, true)
  assert.equal(status.source, 'absent')
  const admitted = await assertLegacyWritesAdmitted({ query })
  assert.equal(admitted.writable, true)
})

test('control-read failure fail-closes writes and GET status', async () => {
  const query = async () => {
    throw Object.assign(new Error('db down'), { code: '57P01' })
  }
  const status = await readLegacyWriteStatus({ query })
  assert.equal(status.writable, false)
  assert.equal(status.source, 'control_read_fail_closed')
  await assert.rejects(
    assertLegacyWritesAdmitted({ query }),
    (error) => error.statusCode === 503 && error.body.error === WRITE_UNAVAILABLE,
  )
})

test('recovery invariant forbids barrier-unaware rollback after freeze', () => {
  assert.match(BARRIER_RECOVERY_INVARIANT, /barrier-unaware/)
  assert.match(BARRIER_RECOVERY_INVARIANT, /badd746/)
  assert.doesNotMatch(BARRIER_RECOVERY_INVARIANT, /redeploy badd746 as recovery/i)
})

test('db trigger errors map to the barrier 503', async () => {
  const triggerError = Object.assign(new Error('history_save_in_progress'), { code: 'P0001' })
  assert.equal(isBarrierTriggerError(triggerError), true)
  const connect = async () => ({
    async query(sql) {
      if (String(sql) === 'BEGIN' || String(sql) === 'ROLLBACK' || String(sql) === 'COMMIT') {
        return { rows: [] }
      }
      if (String(sql).includes('to_regclass')) {
        return { rows: [{ name: 'parle_legacy_write_barrier' }] }
      }
      if (String(sql).includes('FOR SHARE')) {
        return { rows: [{ frozen: false, epoch: 4 }] }
      }
      throw new Error(`unexpected sql ${sql}`)
    },
    release() {},
  })
  await assert.rejects(
    withLegacyMutation(async () => {
      throw triggerError
    }, { connect }),
    (error) => error.statusCode === 503 && error.body.source === 'db_guard',
  )
})

test('sequence A fail-opens when 0011 is absent; sequence B admits unfrozen 0011', async () => {
  const absent = async (sql) => {
    if (String(sql).includes('to_regclass')) return { rows: [{ name: null }] }
    throw new Error('should not read barrier row')
  }
  const presentLive = async (sql) => {
    if (String(sql).includes('to_regclass')) return { rows: [{ name: 'parle_legacy_write_barrier' }] }
    if (String(sql).includes('FROM parle_legacy_write_barrier')) {
      return { rows: [{ frozen: false, epoch: 1 }] }
    }
    throw new Error(`unexpected sql ${sql}`)
  }
  assert.equal((await readLegacyWriteStatus({ query: absent })).writable, true)
  assert.equal((await readLegacyWriteStatus({ query: presentLive })).writable, true)
})

test('frozen lock is taken before work runs', async () => {
  let workRan = false
  const connect = async () => ({
    async query(sql) {
      if (String(sql) === 'BEGIN' || String(sql) === 'ROLLBACK' || String(sql) === 'COMMIT') {
        return { rows: [] }
      }
      if (String(sql).includes('to_regclass')) {
        return { rows: [{ name: 'parle_legacy_write_barrier' }] }
      }
      if (String(sql).includes('FOR SHARE')) {
        return { rows: [{ frozen: true, epoch: 3 }] }
      }
      throw new Error(`unexpected sql ${sql}`)
    },
    release() {},
  })
  await assert.rejects(
    withLegacyMutation(async () => {
      workRan = true
    }, { connect }),
    (error) => error.body.error === WRITE_UNAVAILABLE,
  )
  assert.equal(workRan, false)
})
