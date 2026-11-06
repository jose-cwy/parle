const test = require('node:test')
const assert = require('node:assert/strict')
const {
  isV2WriteFlagOn,
  isV2SurfaceEnabled,
  v2WritesAllowed,
  PRIMARY_BRANCH_ID,
  REHEARSAL_BRANCH_ID,
} = require('../../lib/parle/v2Rollout')

test('V2 writes and surface default off and are distinct from generation recovery', () => {
  assert.equal(isV2WriteFlagOn({}), false)
  assert.equal(isV2SurfaceEnabled({}), false)
  assert.equal(isV2WriteFlagOn({ PARLE_V2_WRITES: '1' }), true)
  assert.equal(isV2SurfaceEnabled({ NEXT_PUBLIC_PARLE_V2_SURFACE: '1' }), true)
  assert.equal(isV2WriteFlagOn({ PARLE_V2_OPS_CONTROL: '1', PARLE_V2_RECOVERY: '1' }), false)
})

test('V2 writes stay disabled without the flag even on rehearsal', async () => {
  const allowed = await v2WritesAllowed({
    env: {},
    query: async () => ({ rows: [{ branch_id: REHEARSAL_BRANCH_ID }] }),
  })
  assert.equal(allowed, false)
})

test('V2 writes never enable on primary even with the flag', async () => {
  const allowed = await v2WritesAllowed({
    env: { PARLE_V2_WRITES: '1' },
    query: async () => ({ rows: [{ branch_id: PRIMARY_BRANCH_ID }] }),
  })
  assert.equal(allowed, false)
})

test('V2 writes enable only with the flag on the rehearsal branch', async () => {
  const allowed = await v2WritesAllowed({
    env: { PARLE_V2_WRITES: '1' },
    query: async () => ({ rows: [{ branch_id: REHEARSAL_BRANCH_ID }] }),
  })
  assert.equal(allowed, true)
})

test('V2 writes fail closed if branch identity cannot be read', async () => {
  const allowed = await v2WritesAllowed({
    env: { PARLE_V2_WRITES: '1' },
    query: async () => {
      throw new Error('db down')
    },
  })
  assert.equal(allowed, false)
})
