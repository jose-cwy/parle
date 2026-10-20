#!/usr/bin/env node
const { Client } = require('pg')
const { publicHost, PRIMARY_BRANCH_ID, EXPECTED_PROJECT_ID } = require('./rehearsalEnv')

async function main() {
  const url = String(process.env.DATABASE_URL || '').trim()
  if (!url) {
    console.log(JSON.stringify({ ok: false, reason: 'DATABASE_URL missing in vercel env run' }))
    process.exit(1)
  }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  try {
    const result = await client.query(`
      select current_database() as db,
             current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id,
             current_setting('neon.endpoint_id', true) as endpoint_id
    `)
    const row = result.rows[0]
    const ok =
      row.project_id === EXPECTED_PROJECT_ID &&
      row.branch_id === PRIMARY_BRANCH_ID &&
      row.db === 'neondb'
    console.log(
      JSON.stringify({
        ok,
        source: 'vercel_env_run',
        host: publicHost(url),
        ...row,
        expected_project_id: EXPECTED_PROJECT_ID,
        expected_branch_id: PRIMARY_BRANCH_ID,
      }),
    )
    process.exit(ok ? 0 : 1)
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
