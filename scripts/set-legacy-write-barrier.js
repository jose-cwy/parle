#!/usr/bin/env node
/**
 * Rehearsal-only operator for the chat_memory write barrier.
 * Refuses the audited primary. Does not wrap or migrate history.
 *
 * Recovery invariant: after freeze, never roll Vercel back to a barrier-unaware
 * SHA (badd746 / Stage 3 a18baba alone). Keep 0011+0012 on the branch and
 * redeploy this barrier-aware build (or later) with freeze still ON.
 * Reads of chat_memory and unsent composer drafts stay. Do not set --live
 * after final reconciliation. A failed V2 cutover recovers by staying on a
 * barrier-aware deployment plus 0012, not by reopening unaware writers.
 */
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { CURRENT_REHEARSAL_BRANCH } = require('./rehearsalEnv')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../lib/db')
const { setLegacyWriteBarrier } = require('../lib/parle/legacyWriteBarrier')

async function main() {
  const frozen = process.argv.includes('--frozen')
  const live = process.argv.includes('--live')
  if (frozen === live) {
    throw new Error('pass exactly one of --frozen or --live')
  }
  const ident = await db.query(`
    SELECT current_setting('neon.project_id', true) AS project_id,
           current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== CURRENT_REHEARSAL_BRANCH) {
    throw new Error(`refusing branch ${ident.rows[0]?.branch_id}`)
  }
  const result = await setLegacyWriteBarrier({
    frozen,
    reason: frozen ? 'rehearsal_freeze' : 'rehearsal_live',
  })
  console.log(JSON.stringify({ branch_id: ident.rows[0].branch_id, ...result }))
}

main().catch((error) => {
  console.error(String(error.message || error).slice(0, 200))
  process.exit(1)
})
