const test = require('node:test')
const assert = require('node:assert/strict')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')
const { CURRENT_REHEARSAL_BRANCH } = require('../../scripts/rehearsalEnv')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../../lib/db')
const { v2WritesAllowed } = require('../../lib/parle/v2Rollout')

test('rehearsal branch allows V2 writes only when the rollout flag is on', async () => {
  const ident = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0].branch_id !== CURRENT_REHEARSAL_BRANCH) {
    throw new Error(`expected rehearsal ${CURRENT_REHEARSAL_BRANCH}`)
  }
  assert.equal(await v2WritesAllowed({ env: { ...process.env, PARLE_V2_WRITES: '' } }), false)
  assert.equal(await v2WritesAllowed({ env: { ...process.env, PARLE_V2_WRITES: '1' } }), true)
})
