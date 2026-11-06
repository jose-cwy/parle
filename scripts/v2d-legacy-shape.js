/**
 * Aggregate-only rehearsal inventory. Never selects or prints message text.
 */
const { Client } = require('pg')
const {
  loadEnvLocal,
  resolveRehearsalUrl,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
  CURRENT_REHEARSAL_BRANCH,
} = require('./rehearsalEnv')

loadEnvLocal()
const REQUIRED_BRANCH = CURRENT_REHEARSAL_BRANCH

async function main() {
  const client = new Client({
    connectionString: resolveRehearsalUrl(),
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  try {
    const ident = await client.query(`
      SELECT current_setting('neon.project_id', true) AS project_id,
             current_setting('neon.branch_id', true) AS branch_id
    `)
    const row = ident.rows[0] || {}
    if (row.project_id !== EXPECTED_PROJECT_ID) throw new Error('unexpected project')
    if (row.branch_id === PRIMARY_BRANCH_ID) throw new Error('refusing primary')
    if (row.branch_id !== REQUIRED_BRANCH) throw new Error(`refusing ${row.branch_id}`)

    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'chat_memory'
      ORDER BY ordinal_position
    `)
    const shape = await client.query(`
      SELECT
        COUNT(*)::bigint AS n,
        COUNT(DISTINCT user_id)::bigint AS users,
        COUNT(*) FILTER (WHERE text LIKE 'enc:v1:%')::bigint AS enc_prefixed,
        COUNT(*) FILTER (WHERE text IS NOT NULL AND text NOT LIKE 'enc:v1:%')::bigint AS not_prefixed,
        COUNT(*) FILTER (WHERE training_content LIKE 'enc:v1:%')::bigint AS training_enc,
        COUNT(*) FILTER (WHERE role = 'user')::bigint AS user_roles,
        COUNT(*) FILTER (WHERE role = 'assistant')::bigint AS assistant_roles,
        COUNT(*) FILTER (WHERE role NOT IN ('user', 'assistant'))::bigint AS other_roles,
        COALESCE(MIN(id), 0)::bigint AS min_id,
        COALESCE(MAX(id), 0)::bigint AS max_id
      FROM chat_memory
    `)
    const dist = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE n = 0)::int AS users_with_zero,
        COUNT(*) FILTER (WHERE n BETWEEN 1 AND 14)::int AS users_1_14,
        COUNT(*) FILTER (WHERE n BETWEEN 15 AND 40)::int AS users_15_40,
        COUNT(*) FILTER (WHERE n BETWEEN 41 AND 200)::int AS users_41_200,
        COUNT(*) FILTER (WHERE n > 200)::int AS users_over_200,
        COALESCE(MAX(n), 0)::int AS max_rows_one_user
      FROM (
        SELECT u.id, COUNT(c.id)::int AS n
        FROM users u
        LEFT JOIN chat_memory c ON c.user_id = u.id
        GROUP BY u.id
      ) t
    `)
    const v2 = await client.query(`
      SELECT
        (SELECT COUNT(*)::bigint FROM conversations) AS conversations,
        (SELECT COUNT(*)::bigint FROM conversation_messages) AS v2_messages,
        (SELECT COUNT(*)::bigint FROM conversations WHERE origin = 'legacy_timeline') AS legacy_origin
    `)
    process.stdout.write(
      `${JSON.stringify({
        branch: row.branch_id,
        columns: cols.rows,
        chat_memory: shape.rows[0],
        per_user: dist.rows[0],
        v2: v2.rows[0],
      })}\n`,
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(String(error.message || error).slice(0, 200))
  process.exit(1)
})
