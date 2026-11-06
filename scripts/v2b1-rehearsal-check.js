const { Client } = require('pg')
const { loadEnvLocal, resolveRehearsalUrl } = require('./rehearsalEnv')

loadEnvLocal()

async function main() {
  const client = new Client({
    connectionString: resolveRehearsalUrl(),
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  try {
    const identity = await client.query(`
      SELECT current_setting('neon.project_id', true) AS project_id,
             current_setting('neon.branch_id', true) AS branch_id
    `)
    const migration = await client.query(`
      SELECT version, status, applied_at
      FROM schema_migrations
      WHERE version = '0005_conversations_v2.sql'
    `)
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('conversations', 'conversation_messages', 'conversation_requests')
      ORDER BY 1
    `)
    const memory = await client.query(`
      SELECT COUNT(*)::bigint AS n, COALESCE(MAX(id), 0)::bigint AS max_id
      FROM chat_memory
    `)
    const leftovers = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM users
      WHERE email LIKE 'v2b1-%@parle.test'
    `)
    process.stdout.write(
      `${JSON.stringify({
        identity: identity.rows[0],
        migration: migration.rows[0] || null,
        tables: tables.rows.map((row) => row.table_name),
        chat_memory: memory.rows[0],
        leftover_synth_users: leftovers.rows[0].n,
      })}\n`,
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
