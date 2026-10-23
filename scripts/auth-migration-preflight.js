#!/usr/bin/env node
/**
 * Read-only 0004 compatibility preflight. Does not ALTER, INSERT, UPDATE, or DELETE.
 *
 * Rehearsal:
 *   node scripts/auth-migration-preflight.js --read-only --rehearsal --require-branch=br-misty-recipe-apcj8oyo
 *
 * Production is refused unless both flags are present (do not run without named approval):
 *   --read-only --i-understand-read-only-production --require-branch=br-morning-sun-apghun9g
 *
 * Never prints email addresses.
 */
const { Client } = require('pg')
const {
  loadEnvLocal,
  publicHost,
  parseRehearsalFlags,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')

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
    throw new Error(`Production preflight requires --require-branch=${PRIMARY_BRANCH_ID}`)
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

    const migrations = await client.query(
      `SELECT version, status FROM schema_migrations ORDER BY version`,
    ).catch(() => ({ rows: [] }))

    const columns = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('email', 'password', 'email_verified_at', 'email_verification_required')
      ORDER BY column_name
    `)

    const duplicateGroups = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM (
        SELECT LOWER(email) AS email_key
        FROM users
        GROUP BY LOWER(email)
        HAVING COUNT(*) > 1
      ) d
    `)

    const nullPasswords = await client.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE password IS NULL`,
    )

    const indexes = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'users_email_lower_idx',
          'auth_challenges_token_hash_idx',
          'auth_challenges_email_purpose_created_idx',
          'user_auth_identities_provider_subject_idx',
          'user_auth_identities_user_provider_idx'
        )
      ORDER BY indexname
    `)

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('auth_challenges', 'user_auth_identities')
      ORDER BY table_name
    `)

    const userCount = await client.query(`SELECT COUNT(*)::int AS n FROM users`)
    const recorded = migrations.rows.map((item) => ({
      version: item.version,
      status: item.status,
    }))
    const colMap = Object.fromEntries(columns.rows.map((item) => [item.column_name, item]))
    const indexNames = indexes.rows.map((item) => item.indexname)
    const tableNames = tables.rows.map((item) => item.table_name)
    const has0004 = recorded.some((item) => String(item.version).includes('0004') && item.status === 'applied')
    const passwordNullable = colMap.password?.is_nullable === 'YES'
    const objectsPresent = tableNames.includes('auth_challenges')
      && tableNames.includes('user_auth_identities')
      && indexNames.includes('users_email_lower_idx')
      && Boolean(colMap.email_verified_at)
      && passwordNullable
    const duplicateEmailGroups = Number(duplicateGroups.rows[0]?.n || 0)
    const blocking = []
    const warnings = []

    if (duplicateEmailGroups > 0) {
      blocking.push('case_insensitive_duplicate_emails')
    }
    if (objectsPresent && !has0004) {
      warnings.push('0004_objects_present_but_unrecorded')
    }
    if (has0004 && !passwordNullable) {
      blocking.push('password_still_not_null_after_0004')
    }
    if ((has0004 || objectsPresent) && !indexNames.includes('users_email_lower_idx')) {
      blocking.push('missing_users_email_lower_idx')
    }
    if ((has0004 || objectsPresent) && !tableNames.includes('auth_challenges')) {
      blocking.push('missing_auth_challenges')
    }
    if ((has0004 || objectsPresent) && !tableNames.includes('user_auth_identities')) {
      blocking.push('missing_user_auth_identities')
    }

    console.log(JSON.stringify({
      readOnly: true,
      host: publicHost(args.databaseUrl),
      branch_id: row.branch_id,
      user_count: Number(userCount.rows[0]?.n || 0),
      schema_migrations: recorded,
      migration_0004_recorded: has0004,
      migration_0004_objects_present: objectsPresent,
      users_columns: colMap,
      password_nullable: passwordNullable,
      null_password_count: Number(nullPasswords.rows[0]?.n || 0),
      case_insensitive_duplicate_email_groups: duplicateEmailGroups,
      required_indexes_present: indexNames,
      auth_tables_present: tableNames,
      blocking,
      warnings,
      rollback_note: 'Do not DROP 0004 objects on production. Rolling the app back to 78a0776 leaves extra columns unused. Do not restore password NOT NULL if null_password_count > 0.',
      apply_note: 'This script never applies 0004. Apply only after named production approval, after blocking is empty.',
    }, null, 2))

    if (blocking.length) process.exitCode = 2
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
