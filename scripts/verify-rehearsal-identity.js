#!/usr/bin/env node
/**
 * Read-only gate: REHEARSAL_DATABASE_URL must be a child of the audited project,
 * not the primary branch. Never prints connection strings.
 */
const { Client } = require('pg')
const {
  loadEnvLocal,
  publicHost,
  resolveRehearsalUrl,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')

async function readIdentity(url, label) {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  try {
    const result = await client.query(`
      select current_database() as db,
             current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id,
             current_setting('neon.endpoint_id', true) as endpoint_id
    `)
    const row = result.rows[0] || {}
    return {
      label,
      host: publicHost(url),
      db: row.db || null,
      project_id: row.project_id || null,
      branch_id: row.branch_id || null,
      endpoint_id: row.endpoint_id || null,
    }
  } finally {
    await client.end().catch(() => {})
  }
}

async function main() {
  loadEnvLocal()
  const rehearsalUrl = resolveRehearsalUrl()
  const rehearsal = await readIdentity(rehearsalUrl, 'rehearsal')
  console.log(JSON.stringify(rehearsal))

  if (!rehearsal.branch_id || !rehearsal.project_id) {
    throw new Error('Could not confirm Neon branch identity (empty project_id or branch_id)')
  }
  if (rehearsal.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error(`Unexpected Neon project_id ${rehearsal.project_id}`)
  }
  if (rehearsal.branch_id === PRIMARY_BRANCH_ID) {
    throw new Error('REHEARSAL_DATABASE_URL points at the primary branch')
  }

  const primaryUrl = String(process.env.DATABASE_URL || '').trim()
  if (primaryUrl) {
    const primary = await readIdentity(primaryUrl, 'primary_env')
    console.log(JSON.stringify(primary))
    if (primary.branch_id && primary.branch_id === rehearsal.branch_id) {
      throw new Error('Rehearsal and DATABASE_URL resolve to the same branch')
    }
    if (primary.branch_id && primary.branch_id !== PRIMARY_BRANCH_ID) {
      console.log('WARN primary_env branch is not the audited primary; rehearsal still looks like a child')
    }
  }

  console.log('REHEARSAL_IDENTITY=ok')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
