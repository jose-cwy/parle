#!/usr/bin/env node
/** Read-only column catalog of DATABASE_URL. Refuses rehearsal URL. */
const { Client } = require('pg')
const {
  loadEnvLocal,
  publicHost,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')

async function main() {
  loadEnvLocal()
  const url = String(process.env.DATABASE_URL || '').trim()
  if (!url) throw new Error('DATABASE_URL missing')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  const ident = await client.query(`
    select current_setting('neon.project_id', true) as project_id,
           current_setting('neon.branch_id', true) as branch_id
  `)
  const { project_id, branch_id } = ident.rows[0]
  if (project_id !== EXPECTED_PROJECT_ID || branch_id !== PRIMARY_BRANCH_ID) {
    throw new Error('Refusing catalog: not the audited primary')
  }
  const cols = await client.query(`
    select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `)
  const fks = await client.query(`
    select
      tc.table_name,
      kcu.column_name,
      ccu.table_name as foreign_table,
      ccu.column_name as foreign_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
    order by 1, 2
  `)
  const grouped = {}
  for (const row of cols.rows) {
    grouped[row.table_name] = grouped[row.table_name] || []
    grouped[row.table_name].push({
      column: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
    })
  }
  console.log(JSON.stringify({
    host: publicHost(url),
    project_id,
    branch_id,
    tables: grouped,
    fks: fks.rows,
  }))
  await client.end()
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
