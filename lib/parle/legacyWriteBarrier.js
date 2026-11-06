const db = require('../db')
const { PRIMARY_BRANCH_ID, CURRENT_REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')

const BARRIER_KEY = 'chat_memory'
const WRITE_UNAVAILABLE = 'history_save_in_progress'
const WRITE_UNAVAILABLE_MESSAGE =
  'Chat is briefly unavailable while we save your history. Your message was not stored. Try again shortly.'
const WRITE_UNAVAILABLE_USER_SAVED_MESSAGE =
  'Chat is briefly unavailable while we save your history. Your last message is already saved. Do not send it again.'
const BARRIER_RECOVERY_INVARIANT =
  'Once the legacy write barrier is frozen, never recover by deploying a barrier-unaware application (including badd746 or the Stage 3 build alone). Recovery must keep 0011+0012 applied and a barrier-aware deployment. chat_memory reads and unsent drafts stay available. After final reconciliation, do not reopen legacy writes.'

function isBarrierTriggerError(error) {
  return (
    error?.code === 'P0001' &&
    String(error.message || '').includes(WRITE_UNAVAILABLE)
  )
}

function barrierUnavailableError(source = 'frozen') {
  const error = new Error(WRITE_UNAVAILABLE)
  error.statusCode = 503
  error.retryable = true
  error.body = {
    error: WRITE_UNAVAILABLE,
    retryable: true,
    message: WRITE_UNAVAILABLE_MESSAGE,
    source,
  }
  return error
}

async function defaultConnect() {
  return db.pool.connect()
}

async function resolveBranch(query) {
  const result = await query(`SELECT current_setting('neon.branch_id', true) AS branch_id`)
  return result.rows[0]?.branch_id || null
}

async function barrierRelation(query) {
  const result = await query(`SELECT to_regclass('public.parle_legacy_write_barrier') AS name`)
  return result.rows[0]?.name || null
}

async function lockBarrierRow(query) {
  const relation = await barrierRelation(query)
  if (!relation) return { missing: true, frozen: false, epoch: 0 }
  const result = await query(
    `SELECT frozen, epoch
     FROM parle_legacy_write_barrier
     WHERE key = $1
     FOR SHARE`,
    [BARRIER_KEY],
  )
  const row = result.rows[0]
  if (!row) {
    throw barrierUnavailableError('missing_row')
  }
  return {
    missing: false,
    frozen: Boolean(row.frozen),
    epoch: Number(row.epoch) || 0,
  }
}

async function withLegacyMutation(work, { connect = defaultConnect } = {}) {
  const client = await connect()
  let admitted = false
  try {
    await client.query('BEGIN')
    const query = (text, params) => client.query(text, params)
    let state
    try {
      state = await lockBarrierRow(query)
    } catch (error) {
      if (error?.statusCode === 503) throw error
      throw barrierUnavailableError('control_read_fail_closed')
    }
    if (state.frozen) {
      throw barrierUnavailableError('frozen')
    }
    admitted = true
    const result = await work(client, state)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    if (isBarrierTriggerError(error)) {
      throw barrierUnavailableError('db_guard')
    }
    if (!admitted && !(error?.statusCode === 503 && error?.body?.error === WRITE_UNAVAILABLE)) {
      throw barrierUnavailableError('control_read_fail_closed')
    }
    throw error
  } finally {
    client.release()
  }
}

async function assertLegacyWritesAdmitted({ query = (text, params) => db.query(text, params) } = {}) {
  try {
    const relation = await barrierRelation(query)
    if (!relation) return { writable: true, frozen: false, epoch: 0 }
    const result = await query(
      `SELECT frozen, epoch FROM parle_legacy_write_barrier WHERE key = $1`,
      [BARRIER_KEY],
    )
    const row = result.rows[0]
    if (!row) throw barrierUnavailableError('missing_row')
    if (row.frozen) throw barrierUnavailableError('frozen')
    return { writable: true, frozen: false, epoch: Number(row.epoch) || 0 }
  } catch (error) {
    if (error?.statusCode === 503) throw error
    throw barrierUnavailableError('control_read_fail_closed')
  }
}

async function readLegacyWriteStatus({ query = (text, params) => db.query(text, params) } = {}) {
  try {
    const relation = await barrierRelation(query)
    if (!relation) {
      return { writable: true, frozen: false, epoch: 0, source: 'absent' }
    }
    const result = await query(
      `SELECT frozen, epoch FROM parle_legacy_write_barrier WHERE key = $1`,
      [BARRIER_KEY],
    )
    const row = result.rows[0]
    if (!row) {
      return { writable: false, frozen: true, epoch: 0, source: 'missing_row' }
    }
    const frozen = Boolean(row.frozen)
    return {
      writable: !frozen,
      frozen,
      epoch: Number(row.epoch) || 0,
      source: 'db',
    }
  } catch {
    return { writable: false, frozen: true, epoch: 0, source: 'control_read_fail_closed' }
  }
}

async function setLegacyWriteBarrier({
  frozen,
  reason,
  connect = defaultConnect,
} = {}) {
  const client = await connect()
  try {
    await client.query('BEGIN')
    const query = (text, params) => client.query(text, params)
    const branchId = await resolveBranch(query)
    if (branchId === PRIMARY_BRANCH_ID) {
      throw new Error('Refusing legacy write barrier changes on the audited primary')
    }
    if (branchId !== CURRENT_REHEARSAL_BRANCH) {
      throw new Error(`Refusing legacy write barrier changes on ${branchId || 'unknown'}`)
    }
    const relation = await barrierRelation(query)
    if (!relation) {
      throw new Error('parle_legacy_write_barrier is not applied')
    }
    const current = await query(
      `SELECT frozen, epoch FROM parle_legacy_write_barrier WHERE key = $1 FOR UPDATE`,
      [BARRIER_KEY],
    )
    if (!current.rows[0]) {
      throw new Error('barrier row missing')
    }
    const nextFrozen = Boolean(frozen)
    const result = await query(
      `UPDATE parle_legacy_write_barrier
       SET frozen = $2,
           epoch = epoch + 1,
           reason = $3,
           updated_at = now()
       WHERE key = $1
       RETURNING frozen, epoch, reason`,
      [BARRIER_KEY, nextFrozen, String(reason || '').slice(0, 200) || null],
    )
    await client.query('COMMIT')
    return result.rows[0]
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  BARRIER_KEY,
  WRITE_UNAVAILABLE,
  WRITE_UNAVAILABLE_MESSAGE,
  WRITE_UNAVAILABLE_USER_SAVED_MESSAGE,
  BARRIER_RECOVERY_INVARIANT,
  isBarrierTriggerError,
  barrierUnavailableError,
  withLegacyMutation,
  assertLegacyWritesAdmitted,
  readLegacyWriteStatus,
  setLegacyWriteBarrier,
  lockBarrierRow,
}
