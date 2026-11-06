const db = require('../db')
const { isProductionEnv, isV2GenerationDisabled, publicGenerationState } = require('./v2Recovery')

const CONTROL_KEY = 'v2_generation'
const CACHE_TTL_MS = 8_000
const ERROR_TTL_MS = 2_000
const REHEARSAL_OPS_BRANCH = 'br-square-unit-apbswjj3'
const PRIMARY_BRANCH_ID = 'br-morning-sun-apghun9g'
const CONFIRM = {
  live: 'LIVE',
  read_only: 'READ_ONLY',
}

const cache = {
  value: 'live',
  revision: 0,
  source: 'cold',
  lastConfirmedValue: null,
  lastConfirmedRevision: 0,
  expiresAt: 0,
  host: null,
}

function isOpsControlExposed(env = process.env) {
  return String(env.PARLE_V2_OPS_CONTROL || '') === '1'
}

function resetGenerationControlCache() {
  cache.value = 'live'
  cache.revision = 0
  cache.source = 'cold'
  cache.lastConfirmedValue = null
  cache.lastConfirmedRevision = 0
  cache.expiresAt = 0
  cache.host = null
}

function inactiveSnapshot(source = 'inactive') {
  return {
    key: CONTROL_KEY,
    value: 'live',
    revision: 0,
    source,
    available: true,
    mode: 'live',
  }
}

function snapshotFromCache() {
  return {
    key: CONTROL_KEY,
    value: cache.value,
    revision: cache.revision,
    source: cache.source,
    available: cache.value !== 'read_only',
    mode: cache.value === 'read_only' ? 'generation_disabled' : 'live',
  }
}

function rememberConfirmed(value, revision, source, ttlMs = CACHE_TTL_MS) {
  cache.value = value
  cache.revision = Number(revision) || 0
  cache.source = source
  cache.lastConfirmedValue = value
  cache.lastConfirmedRevision = cache.revision
  cache.expiresAt = Date.now() + ttlMs
}

function stickyOrUnknown(source, ttlMs = ERROR_TTL_MS) {
  if (cache.lastConfirmedValue === 'read_only') {
    cache.value = 'read_only'
    cache.revision = cache.lastConfirmedRevision
    cache.source = source
    cache.expiresAt = Date.now() + ttlMs
    return snapshotFromCache()
  }
  if (cache.lastConfirmedValue === 'live') {
    cache.value = 'live'
    cache.revision = cache.lastConfirmedRevision
    cache.source = source
    cache.expiresAt = Date.now() + ttlMs
    return snapshotFromCache()
  }
  cache.value = 'read_only'
  cache.source = 'error_unknown_fail_closed'
  cache.expiresAt = Date.now() + ttlMs
  return snapshotFromCache()
}

async function defaultQuery(text, params) {
  return db.query(text, params)
}

async function resolveOpsHost(query) {
  if (cache.host && cache.host.expiresAt > Date.now()) return cache.host
  try {
    const result = await query(
      `SELECT current_setting('neon.branch_id', true) AS branch_id`,
    )
    const branchId = result.rows[0]?.branch_id || null
    const allowed = branchId === REHEARSAL_OPS_BRANCH
    const primary = branchId === PRIMARY_BRANCH_ID
    cache.host = {
      branchId,
      allowed,
      primary,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }
    return cache.host
  } catch (error) {
    console.error('ops_control_host_read_failed', { code: error?.code || 'unknown' })
    cache.host = {
      branchId: null,
      allowed: false,
      primary: false,
      expiresAt: Date.now() + ERROR_TTL_MS,
      error: true,
    }
    return cache.host
  }
}

async function loadGenerationControl({
  force = false,
  env = process.env,
  query = defaultQuery,
} = {}) {
  if (!isOpsControlExposed(env)) {
    return inactiveSnapshot('inactive')
  }

  const now = Date.now()
  if (!force && cache.expiresAt > now && cache.source !== 'cold') {
    return snapshotFromCache()
  }

  const host = await resolveOpsHost(query)
  if (host.primary) {
    rememberConfirmed('live', 0, 'primary_refused')
    return inactiveSnapshot('primary_refused')
  }
  if (!host.allowed) {
    if (host.error) return stickyOrUnknown('host_error', ERROR_TTL_MS)
    return inactiveSnapshot('wrong_branch')
  }

  try {
    const result = await query(
      `SELECT value, revision, updated_at
       FROM parle_ops_controls
       WHERE key = $1
       LIMIT 1`,
      [CONTROL_KEY],
    )
    const row = result.rows[0]
    if (!row) {
      if (cache.lastConfirmedValue === 'read_only') {
        console.error('ops_control_missing_sticky', { key: CONTROL_KEY })
        return stickyOrUnknown('sticky_missing', CACHE_TTL_MS)
      }
      rememberConfirmed('live', 0, 'default_missing')
      return snapshotFromCache()
    }
    const value = row.value === 'read_only' ? 'read_only' : 'live'
    rememberConfirmed(value, row.revision, 'db')
    return snapshotFromCache()
  } catch (error) {
    console.error('ops_control_read_failed', { code: error?.code || 'unknown' })
    return stickyOrUnknown('sticky_error', ERROR_TTL_MS)
  }
}

async function isV2GenerationBlocked(env = process.env, query = defaultQuery) {
  if (isV2GenerationDisabled(env)) return true
  if (isProductionEnv(env) && !isOpsControlExposed(env)) return false
  const snap = await loadGenerationControl({ env, query })
  return snap.value === 'read_only'
}

async function publicGenerationSnapshot(env = process.env, query = defaultQuery) {
  const envState = publicGenerationState(env)
  if (envState.recovery) return envState
  const snap = await loadGenerationControl({ env, query })
  const blocked = snap.value === 'read_only'
  return {
    available: !blocked,
    recovery: blocked,
    mode: blocked ? 'generation_disabled' : 'live',
  }
}

function httpError(statusCode, body) {
  const error = new Error(body.error)
  error.statusCode = statusCode
  error.body = body
  return error
}

async function setGenerationControl({
  actorId,
  value,
  confirm,
  reason,
  expectedRevision,
  env = process.env,
  query = defaultQuery,
  connect,
} = {}) {
  if (!isOpsControlExposed(env)) {
    throw httpError(404, { error: 'Not found' })
  }
  const nextValue = value === 'read_only' ? 'read_only' : value === 'live' ? 'live' : null
  if (!nextValue) {
    throw httpError(400, { error: 'invalid_value' })
  }
  if (String(confirm || '') !== CONFIRM[nextValue]) {
    throw httpError(400, { error: 'confirmation_required' })
  }
  const trimmedReason = String(reason || '').trim()
  if (trimmedReason.length < 8) {
    throw httpError(400, { error: 'reason_required' })
  }
  if (!actorId) {
    throw httpError(404, { error: 'Not found' })
  }
  const expected = Number(expectedRevision)
  if (!Number.isInteger(expected) || expected < 0) {
    throw httpError(400, { error: 'revision_required' })
  }

  const host = await resolveOpsHost(query)
  if (host.primary || !host.allowed) {
    throw httpError(404, { error: 'Not found' })
  }

  const opener = connect || (() => db.pool.connect())
  const client = await opener()
  try {
    await client.query('BEGIN')
    const locked = await client.query(
      `SELECT key, value, revision FROM parle_ops_controls WHERE key = $1 FOR UPDATE`,
      [CONTROL_KEY],
    )
    const current = locked.rows[0] || null
    const currentRevision = current ? Number(current.revision) : 0
    if (currentRevision !== expected) {
      await client.query('ROLLBACK')
      throw httpError(409, {
        error: 'revision_conflict',
        revision: currentRevision,
      })
    }
    const nextRevision = currentRevision + 1
    let stored
    if (!current) {
      stored = await client.query(
        `INSERT INTO parle_ops_controls (key, value, revision, updated_by, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING key, value, revision, updated_at, reason`,
        [CONTROL_KEY, nextValue, nextRevision, actorId, trimmedReason],
      )
    } else {
      stored = await client.query(
        `UPDATE parle_ops_controls
         SET value = $2,
             revision = $3,
             updated_by = $4,
             updated_at = now(),
             reason = $5
         WHERE key = $1 AND revision = $6
         RETURNING key, value, revision, updated_at, reason`,
        [CONTROL_KEY, nextValue, nextRevision, actorId, trimmedReason, expected],
      )
      if (!stored.rows[0]) {
        await client.query('ROLLBACK')
        throw httpError(409, { error: 'revision_conflict' })
      }
    }
    await client.query(
      `INSERT INTO parle_ops_control_audit
         (key, old_value, new_value, revision, actor_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        CONTROL_KEY,
        current ? current.value : null,
        nextValue,
        nextRevision,
        actorId,
        trimmedReason,
      ],
    )
    await client.query('COMMIT')
    rememberConfirmed(nextValue, nextRevision, 'db', CACHE_TTL_MS)
    console.info('ops_control_changed', {
      key: CONTROL_KEY,
      actorId,
      oldValue: current ? current.value : null,
      newValue: nextValue,
      revision: nextRevision,
      reason: trimmedReason,
    })
    return {
      key: CONTROL_KEY,
      value: stored.rows[0].value,
      revision: Number(stored.rows[0].revision),
      source: 'db',
      available: stored.rows[0].value !== 'read_only',
      mode:
        stored.rows[0].value === 'read_only' ? 'generation_disabled' : 'live',
    }
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
  CONTROL_KEY,
  CACHE_TTL_MS,
  REHEARSAL_OPS_BRANCH,
  isOpsControlExposed,
  resetGenerationControlCache,
  loadGenerationControl,
  isV2GenerationBlocked,
  publicGenerationSnapshot,
  setGenerationControl,
}
