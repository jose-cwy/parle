#!/usr/bin/env node
/** Read-only: primary must still lack archive_legacy and schema_migrations. */
const { Client } = require('pg')
const { loadEnvLocal, publicHost, PRIMARY_BRANCH_ID } = require('./rehearsalEnv')

loadEnvLocal()

async function main() {
  const url = String(process.env.DATABASE_URL || '').trim()
  if (!url) throw new Error('DATABASE_URL missing')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  const ident = await client.query(`
    select current_setting('neon.branch_id', true) as branch_id,
           current_setting('neon.project_id', true) as project_id
  `)
  const branchId = ident.rows[0].branch_id
  if (branchId !== PRIMARY_BRANCH_ID) {
    throw new Error(`DATABASE_URL is not the audited primary (${branchId})`)
  }
  const archive = await client.query(`
    select schema_name from information_schema.schemata where schema_name = 'archive_legacy'
  `)
  const ledger = await client.query(`
    select 1 from information_schema.tables
    where table_schema='public' and table_name='schema_migrations'
  `)
  const legacyPublic = await client.query(`
    select table_name from information_schema.tables
    where table_schema='public' and table_name = ANY($1)
    order by 1
  `, [[
    'chat_messages',
    'diary_entries',
    'future_letters',
    'guest_exit_feedback',
    'journey_progress',
    'profiles',
    'session_feedback',
    'sessions',
    'auth_tokens',
    'deep_feedback',
  ]])
  const synth = await client.query(`
    SELECT count(*)::int AS n FROM users WHERE email LIKE '%@parle.test'
  `)
  console.log(JSON.stringify({
    host: publicHost(url),
    branch_id: branchId,
    archive_legacy: archive.rows.length > 0,
    schema_migrations: ledger.rows.length > 0,
    legacy_still_public: legacyPublic.rows.map((r) => r.table_name),
    synth_user_leftover: synth.rows[0].n,
  }))
  await client.end()
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
