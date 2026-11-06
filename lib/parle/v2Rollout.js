/**
 * Stage 3 rollout eligibility — not the emergency generation read_only control.
 * Default off. Writes require PARLE_V2_WRITES=1 on the rehearsal Neon branch only.
 * Primary never accepts V2 writes even if the env flag is set.
 */
const db = require('../db')

const REHEARSAL_BRANCH_ID = 'br-rough-lab-apixtzmm'
const PRIMARY_BRANCH_ID = 'br-morning-sun-apghun9g'

const WRITE_DISABLED = 'v2_writes_disabled'

function isV2WriteFlagOn(env = process.env) {
  return String(env.PARLE_V2_WRITES || '') === '1'
}

function isV2SurfaceEnabled(env = process.env) {
  return String(env.NEXT_PUBLIC_PARLE_V2_SURFACE || '') === '1'
}

function v2WritesDisabledError() {
  const error = new Error(WRITE_DISABLED)
  error.statusCode = 403
  error.body = { error: WRITE_DISABLED }
  return error
}

async function resolveWriteHost(query) {
  const result = await query(`SELECT current_setting('neon.branch_id', true) AS branch_id`)
  return result.rows[0]?.branch_id || null
}

async function v2WritesAllowed({
  env = process.env,
  query = (text, params) => db.query(text, params),
} = {}) {
  if (!isV2WriteFlagOn(env)) return false
  try {
    const branchId = await resolveWriteHost(query)
    if (!branchId || branchId === PRIMARY_BRANCH_ID) return false
    return branchId === REHEARSAL_BRANCH_ID
  } catch {
    return false
  }
}

async function assertV2WritesAllowed(options) {
  if (!(await v2WritesAllowed(options))) {
    throw v2WritesDisabledError()
  }
}

module.exports = {
  WRITE_DISABLED,
  REHEARSAL_BRANCH_ID,
  PRIMARY_BRANCH_ID,
  isV2WriteFlagOn,
  isV2SurfaceEnabled,
  v2WritesDisabledError,
  v2WritesAllowed,
  assertV2WritesAllowed,
}
