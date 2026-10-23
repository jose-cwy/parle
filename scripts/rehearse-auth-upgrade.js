#!/usr/bin/env node
/**
 * Rehearsal-only: email verify + founder admin gate against REHEARSAL_DATABASE_URL.
 * Never uses DATABASE_URL / primary.
 */
const bcrypt = require('bcryptjs')
const { Client } = require('pg')
const {
  loadEnvLocal,
  resolveRehearsalUrl,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')
const { hashToken } = require('../lib/parle/authChallenges')
const { isAdminEmail } = require('../lib/parle/metricsExclude')
const { adminRequireVerifiedEmail } = require('../lib/parle/authAccess')

async function adminGate(client, userId, env) {
  const result = await client.query('SELECT id, email, email_verified_at FROM users WHERE id = $1 LIMIT 1', [userId])
  const row = result.rows[0]
  if (!row || !isAdminEmail(row.email, env)) return { ok: false }
  if (adminRequireVerifiedEmail(env) && !row.email_verified_at) return { ok: false, reason: 'unverified' }
  return { ok: true, user: row }
}

async function main() {
  loadEnvLocal()
  const url = resolveRehearsalUrl()
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  const identity = await client.query(`
    select current_setting('neon.project_id', true) as project_id,
           current_setting('neon.branch_id', true) as branch_id
  `)
  const row = identity.rows[0]
  if (row.project_id !== EXPECTED_PROJECT_ID) throw new Error('unexpected project')
  if (row.branch_id === PRIMARY_BRANCH_ID) throw new Error('refusing primary')

  const email = `founder-rehearse-${Date.now()}@parle.test`
  const hash = await bcrypt.hash('RehearsePass123!', 10)
  const inserted = await client.query(
    `INSERT INTO users (email, password, preferred_name, email_verification_required)
     VALUES ($1,$2,'Founder', TRUE)
     RETURNING id, email`,
    [email, hash],
  )
  const user = inserted.rows[0]
  const env = { ADMIN_EMAILS: email, PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL: 'true' }
  const token = 'rehearse-token-' + Date.now()
  await client.query(
    `INSERT INTO auth_challenges (user_id, email, purpose, token_hash, expires_at, last_sent_at)
     VALUES ($1,$2,'existing_verify',$3, now() + interval '1 day', now())`,
    [user.id, email, hashToken(token)],
  )

  const unverified = await adminGate(client, user.id, env)
  if (unverified.ok) throw new Error('unverified founder must not pass admin gate')

  const consume = await client.query(
    `UPDATE auth_challenges SET consumed_at = now()
     WHERE token_hash = $1 AND consumed_at IS NULL RETURNING id`,
    [hashToken(token)],
  )
  if (!consume.rows.length) throw new Error('expected first consume')
  await client.query(`UPDATE users SET email_verified_at = now() WHERE id = $1`, [user.id])

  const verified = await adminGate(client, user.id, env)
  if (!verified.ok) throw new Error('verified founder must pass admin gate')

  const reused = await client.query(
    `UPDATE auth_challenges SET consumed_at = now()
     WHERE token_hash = $1 AND consumed_at IS NULL RETURNING id`,
    [hashToken(token)],
  )
  if (reused.rows.length) throw new Error('token must be single-use')

  const expired = await client.query(
    `INSERT INTO auth_challenges (user_id, email, purpose, token_hash, expires_at, last_sent_at)
     VALUES ($1,$2,'signup',$3, now() - interval '1 minute', now()) RETURNING token_hash`,
    [user.id, email, hashToken(token + '-expired')],
  )
  const expiredConsume = await client.query(
    `UPDATE auth_challenges SET consumed_at = now()
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now() RETURNING id`,
    [expired.rows[0].token_hash],
  )
  if (expiredConsume.rows.length) throw new Error('expired token must not redeem')

  console.log(JSON.stringify({
    ok: true,
    branch_id: row.branch_id,
    founderUnverifiedBlocked: true,
    founderVerifiedAllowed: true,
    tokenSingleUse: true,
    expiredRejected: true,
    userId: user.id,
  }))
  await client.end()
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
