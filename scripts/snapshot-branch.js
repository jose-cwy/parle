#!/usr/bin/env node
/**
 * Read-only table/count snapshot. --rehearsal uses REHEARSAL_DATABASE_URL only.
 */
const { Client } = require('pg')
const {
  loadEnvLocal,
  publicHost,
  resolveRehearsalUrl,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')

function quoteIdent(name) {
  if (!/^[a-z0-9_]+$/.test(String(name))) {
    throw new Error(`unsafe ident ${name}`)
  }
  return String(name)
}

async function snapshot(url, label) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  try {
    const ident = await client.query(`
      select current_database() as db,
             current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id,
             current_setting('neon.endpoint_id', true) as endpoint_id
    `)
    const identity = ident.rows[0]
    const tables = await client.query(`
      select n.nspname as schema, c.relname as table
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname in ('public', 'archive_legacy')
      order by 1, 2
    `)
    const exact = []
    for (const row of tables.rows) {
      const n = await client.query(
        `select count(*)::int as n from ${quoteIdent(row.schema)}.${quoteIdent(row.table)}`,
      )
      exact.push({
        schema: row.schema,
        table: row.table,
        rows: n.rows[0].n,
      })
    }
    const hasLedger = exact.some((r) => r.schema === 'public' && r.table === 'schema_migrations')
    let migrations = []
    if (hasLedger) {
      const applied = await client.query(
        'select version, status from schema_migrations order by version',
      )
      migrations = applied.rows
    }
    return {
      label,
      host: publicHost(url),
      db: identity.db,
      project_id: identity.project_id,
      branch_id: identity.branch_id,
      endpoint_id: identity.endpoint_id,
      migrations,
      tables: exact,
    }
  } finally {
    await client.end().catch(() => {})
  }
}

async function main() {
  loadEnvLocal()
  const url = resolveRehearsalUrl()
  const child = await snapshot(url, 'rehearsal')
  if (!child.branch_id || child.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error('Could not confirm rehearsal identity')
  }
  if (child.branch_id === PRIMARY_BRANCH_ID) {
    throw new Error('REHEARSAL_DATABASE_URL is the primary')
  }
  console.log(JSON.stringify(child, null, 2))

  const primaryUrl = String(process.env.DATABASE_URL || '').trim()
  if (primaryUrl) {
    const primary = await snapshot(primaryUrl, 'primary_env')
    if (primary.branch_id !== PRIMARY_BRANCH_ID) {
      throw new Error('DATABASE_URL is not the audited primary')
    }
    console.log(JSON.stringify(primary, null, 2))
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
