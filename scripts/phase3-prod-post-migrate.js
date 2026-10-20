#!/usr/bin/env node
const { Client } = require('pg')
const { loadEnvLocal, publicHost, PRIMARY_BRANCH_ID, EXPECTED_PROJECT_ID } = require('./rehearsalEnv')
const { EXPECTED_0003_CHECKSUM } = require('./migrate')

loadEnvLocal()

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  try {
    const ident = await client.query(`
      select current_database() as db,
             current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id
    `)
    const row = ident.rows[0]
    if (row.project_id !== EXPECTED_PROJECT_ID || row.branch_id !== PRIMARY_BRANCH_ID) {
      throw new Error('post-migrate identity mismatch')
    }
    const ledger = await client.query(
      `SELECT version, checksum, status FROM schema_migrations ORDER BY version`,
    )
    const cols = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND (
          (table_name='users' AND column_name='first_activated_at')
          OR (table_name='product_feedback' AND column_name='dimension')
        )
      ORDER BY 1,2
    `)
    const indexes = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('product_events','product_feedback','users')
        AND (
          indexname LIKE 'product_events%'
          OR indexname LIKE 'idx_product_events%'
          OR indexname = 'idx_product_feedback_dimension_created'
        )
      ORDER BY 1
    `)
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM chat_memory) AS chat_memory,
        (SELECT COUNT(*)::int FROM message_feedback) AS message_feedback,
        (SELECT COUNT(*)::int FROM product_feedback) AS product_feedback,
        (SELECT COUNT(*)::int FROM product_events) AS product_events
    `)
    const only0003 = ledger.rows.every((item) => item.version === '0003_phase3_analytics.sql')
    const applied = ledger.rows.find((item) => item.version === '0003_phase3_analytics.sql')
    console.log(
      JSON.stringify(
        {
          host: publicHost(process.env.DATABASE_URL),
          ident: row,
          ledger: ledger.rows,
          only0003,
          checksumMatch: applied?.checksum === EXPECTED_0003_CHECKSUM && applied?.status === 'applied',
          columns: cols.rows,
          indexes: indexes.rows.map((item) => item.indexname),
          counts: counts.rows[0],
        },
        null,
        2,
      ),
    )
    if (!only0003) throw new Error('unexpected extra migrations on primary ledger')
    if (!applied || applied.status !== 'applied' || applied.checksum !== EXPECTED_0003_CHECKSUM) {
      throw new Error('0003 ledger row invalid')
    }
    if (counts.rows[0].users !== 12 || counts.rows[0].chat_memory !== 146) {
      throw new Error('existing data counts changed')
    }
    if (counts.rows[0].message_feedback !== 11 || counts.rows[0].product_feedback !== 7) {
      throw new Error('feedback counts changed')
    }
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
