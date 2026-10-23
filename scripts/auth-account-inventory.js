#!/usr/bin/env node
/**
 * Read-only account inventory. Does not UPDATE/DELETE.
 *
 * Default: rehearsal URL.
 *   node scripts/auth-account-inventory.js --read-only --rehearsal --require-branch=br-misty-recipe-apcj8oyo
 *
 * Production is refused unless you pass both:
 *   --read-only --i-understand-read-only-production --require-branch=<primary>
 * Do not run production inventory without named approval.
 */
const { Client } = require('pg')
const {
  loadEnvLocal,
  publicHost,
  parseRehearsalFlags,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')
const { isAdminEmail } = require('../lib/parle/metricsExclude')

function hasFlag(argv, name) {
  return argv.includes(name)
}

async function main() {
  loadEnvLocal()
  const argv = process.argv
  if (!hasFlag(argv, '--read-only')) {
    throw new Error('Refusing: pass --read-only')
  }
  const args = parseRehearsalFlags(argv)
  const productionAck = hasFlag(argv, '--i-understand-read-only-production')
  if (!args.rehearsal && !productionAck) {
    throw new Error('Refusing production. Use --rehearsal, or wait for approval before --i-understand-read-only-production')
  }
  if (args.rehearsal && args.requireBranch === PRIMARY_BRANCH_ID) {
    throw new Error('Refusing --rehearsal against the primary branch')
  }
  if (!args.rehearsal && productionAck && args.requireBranch !== PRIMARY_BRANCH_ID) {
    throw new Error(`Production inventory requires --require-branch=${PRIMARY_BRANCH_ID}`)
  }

  const client = new Client({
    connectionString: args.databaseUrl,
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  try {
    const identity = await client.query(`
      select current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id
    `)
    const row = identity.rows[0] || {}
    if (row.project_id !== EXPECTED_PROJECT_ID) {
      throw new Error('Unexpected Neon project')
    }
    if (args.requireBranch && row.branch_id !== args.requireBranch) {
      throw new Error(`Branch mismatch ${row.branch_id} vs ${args.requireBranch}`)
    }
    if (args.rehearsal && row.branch_id === PRIMARY_BRANCH_ID) {
      throw new Error('Connected to primary during rehearsal')
    }

    const users = await client.query(`
      SELECT
        u.id,
        u.email,
        u.created_at,
        (u.preferred_name IS NOT NULL AND btrim(u.preferred_name) <> '') AS has_preferred_name,
        (u.password IS NOT NULL AND u.password <> '') AS has_password,
        u.email_verified_at IS NOT NULL AS email_verified,
        (SELECT COUNT(*)::int FROM chat_memory c WHERE c.user_id = u.id) AS chat_messages,
        (SELECT COUNT(*)::int FROM diary d WHERE d.user_id = u.id) AS journal_entries,
        (SELECT COUNT(*)::int FROM quote_favorites q WHERE q.user_id = u.id) AS quote_favorites,
        (SELECT COUNT(*)::int FROM product_events e WHERE e.user_id = u.id) AS product_events
      FROM users u
      ORDER BY u.created_at ASC
    `)

    const records = users.rows.map((item) => ({
      id: item.id,
      email: item.email,
      created_at: item.created_at,
      has_preferred_name: item.has_preferred_name,
      has_password: item.has_password,
      email_verified: item.email_verified,
      admin_allowlist_match: isAdminEmail(item.email),
      parle_test: String(item.email || '').toLowerCase().endsWith('@parle.test'),
      chat_messages: item.chat_messages,
      journal_entries: item.journal_entries,
      quote_favorites: item.quote_favorites,
      product_events: item.product_events,
    }))

    console.log(JSON.stringify({
      host: publicHost(args.databaseUrl),
      branch_id: row.branch_id,
      readOnly: true,
      count: records.length,
      accounts: records,
    }, null, 2))
  } finally {
    await client.end().catch(() => {})
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })
}

module.exports = { hasFlag }
