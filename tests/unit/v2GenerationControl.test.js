const test = require('node:test')
const assert = require('node:assert/strict')
const {
  isOpsControlExposed,
  resetGenerationControlCache,
  loadGenerationControl,
  isV2GenerationBlocked,
  publicGenerationSnapshot,
  setGenerationControl,
} = require('../../lib/parle/v2GenerationControl')

test('ops control is off unless PARLE_V2_OPS_CONTROL=1', async () => {
  resetGenerationControlCache()
  assert.equal(isOpsControlExposed({}), false)
  assert.equal(isOpsControlExposed({ PARLE_V2_OPS_CONTROL: '1' }), true)
  const snap = await loadGenerationControl({ env: { NODE_ENV: 'production' } })
  assert.equal(snap.value, 'live')
  assert.equal(snap.source, 'inactive')
  assert.equal(await isV2GenerationBlocked({ NODE_ENV: 'production', PARLE_V2_RECOVERY: '1' }), false)
})

test('missing control row defaults to live', async () => {
  resetGenerationControlCache()
  const query = async (sql) => {
    if (String(sql).includes('neon.branch_id')) {
      return { rows: [{ branch_id: 'br-rough-lab-apixtzmm' }] }
    }
    return { rows: [] }
  }
  const snap = await loadGenerationControl({
    env: { PARLE_V2_OPS_CONTROL: '1' },
    query,
    force: true,
  })
  assert.equal(snap.value, 'live')
  assert.equal(snap.source, 'default_missing')
})

test('confirmed read_only stays read_only when the control read fails', async () => {
  resetGenerationControlCache()
  let reads = 0
  const query = async (sql) => {
    if (String(sql).includes('neon.branch_id')) {
      return { rows: [{ branch_id: 'br-rough-lab-apixtzmm' }] }
    }
    reads += 1
    if (reads === 1) return { rows: [{ value: 'read_only', revision: 4 }] }
    throw Object.assign(new Error('db down'), { code: '57P01' })
  }
  const env = { PARLE_V2_OPS_CONTROL: '1' }
  const first = await loadGenerationControl({ env, query, force: true })
  assert.equal(first.value, 'read_only')
  const failed = await loadGenerationControl({ env, query, force: true })
  assert.equal(failed.value, 'read_only')
  assert.equal(failed.source, 'sticky_error')
  assert.equal(await isV2GenerationBlocked(env, query), true)
  const pub = await publicGenerationSnapshot(env, query)
  assert.equal(pub.available, false)
  assert.equal(pub.mode, 'generation_disabled')
})

test('new sends bypass the live success cache and fail closed on control-read errors', async () => {
  resetGenerationControlCache()
  const env = { PARLE_V2_OPS_CONTROL: '1' }
  let mode = 'live'
  let fail = false
  let controlReads = 0
  const query = async (sql) => {
    if (String(sql).includes('neon.branch_id')) {
      return { rows: [{ branch_id: 'br-rough-lab-apixtzmm' }] }
    }
    if (String(sql).includes('FROM parle_ops_controls')) {
      controlReads += 1
      if (fail) throw Object.assign(new Error('db down'), { code: '57P01' })
      return { rows: [{ value: mode, revision: 1 }] }
    }
    return { rows: [] }
  }

  assert.equal((await loadGenerationControl({ env, query, force: true })).value, 'live')
  const afterWarm = controlReads
  assert.equal((await publicGenerationSnapshot(env, query)).available, true)
  assert.equal(controlReads, afterWarm)

  fail = true
  assert.equal(await isV2GenerationBlocked(env, query), true)
  assert.ok(controlReads > afterWarm)
  assert.equal((await publicGenerationSnapshot(env, query)).available, true)

  fail = false
  mode = 'read_only'
  assert.equal(await isV2GenerationBlocked(env, query), true)
})

test('unknown control-read failure fail-closes to read_only', async () => {
  resetGenerationControlCache()
  const query = async (sql) => {
    if (String(sql).includes('neon.branch_id')) {
      return { rows: [{ branch_id: 'br-rough-lab-apixtzmm' }] }
    }
    throw Object.assign(new Error('db down'), { code: '57P01' })
  }
  const snap = await loadGenerationControl({
    env: { PARLE_V2_OPS_CONTROL: '1' },
    query,
    force: true,
  })
  assert.equal(snap.value, 'read_only')
  assert.equal(snap.source, 'error_unknown_fail_closed')
})

test('setGenerationControl requires confirmation, reason, and matching revision', async () => {
  resetGenerationControlCache()
  const env = { PARLE_V2_OPS_CONTROL: '1' }
  const query = async (sql) => {
    if (String(sql).includes('neon.branch_id')) {
      return { rows: [{ branch_id: 'br-rough-lab-apixtzmm' }] }
    }
    return { rows: [] }
  }
  await assert.rejects(
    setGenerationControl({
      actorId: '11111111-1111-4111-8111-111111111111',
      value: 'read_only',
      confirm: 'LIVE',
      reason: 'pause generation now',
      expectedRevision: 0,
      env,
      query,
    }),
    (error) => error.statusCode === 400 && error.body.error === 'confirmation_required',
  )
  await assert.rejects(
    setGenerationControl({
      actorId: '11111111-1111-4111-8111-111111111111',
      value: 'read_only',
      confirm: 'READ_ONLY',
      reason: 'short',
      expectedRevision: 0,
      env,
      query,
    }),
    (error) => error.statusCode === 400 && error.body.error === 'reason_required',
  )

  let revision = 0
  const client = {
    async query(sql, params) {
      const text = String(sql)
      if (text.startsWith('BEGIN') || text.startsWith('COMMIT') || text.startsWith('ROLLBACK')) {
        return { rows: [] }
      }
      if (text.includes('FOR UPDATE')) {
        return {
          rows: revision
            ? [{ key: 'v2_generation', value: 'live', revision }]
            : [],
        }
      }
      if (text.startsWith('INSERT INTO parle_ops_controls') || text.startsWith('UPDATE parle_ops_controls')) {
        if (text.startsWith('UPDATE') && Number(params[5]) !== revision) {
          return { rows: [] }
        }
        revision = Number(params[2])
        return {
          rows: [{
            key: 'v2_generation',
            value: params[1],
            revision,
            updated_at: new Date(),
            reason: params[4],
          }],
        }
      }
      return { rows: [] }
    },
    release() {},
  }
  const first = await setGenerationControl({
    actorId: '11111111-1111-4111-8111-111111111111',
    value: 'read_only',
    confirm: 'READ_ONLY',
    reason: 'pause generation now',
    expectedRevision: 0,
    env,
    query,
    connect: async () => client,
  })
  assert.equal(first.value, 'read_only')
  assert.equal(first.revision, 1)
  await assert.rejects(
    setGenerationControl({
      actorId: '11111111-1111-4111-8111-111111111111',
      value: 'live',
      confirm: 'LIVE',
      reason: 'resume generation now',
      expectedRevision: 0,
      env,
      query,
      connect: async () => client,
    }),
    (error) => error.statusCode === 409 && error.body.error === 'revision_conflict',
  )
})

test('re-enable still requires LIVE confirmation even after a sticky read', async () => {
  resetGenerationControlCache()
  await assert.rejects(
    setGenerationControl({
      actorId: '11111111-1111-4111-8111-111111111111',
      value: 'live',
      confirm: 'READ_ONLY',
      reason: 'resume generation now',
      expectedRevision: 1,
      env: { PARLE_V2_OPS_CONTROL: '1' },
    }),
    (error) => error.statusCode === 400,
  )
})
