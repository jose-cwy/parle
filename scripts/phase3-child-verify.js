#!/usr/bin/env node
/**
 * Rehearse 0003 on the Neon child only. Never uses DATABASE_URL.
 */
const { spawnSync } = require('child_process')
const { Client } = require('pg')
const { loadEnvLocal, publicHost, PRIMARY_BRANCH_ID, EXPECTED_PROJECT_ID } = require('./rehearsalEnv')
const { checksum, sqlIsAdditive } = require('./migrate')
const fs = require('fs')
const path = require('path')

loadEnvLocal()

const CHILD = 'br-misty-recipe-apcj8oyo'
const sqlPath = path.join(__dirname, '..', 'database', 'migrations', '0003_phase3_analytics.sql')

async function main() {
  const url = String(process.env.REHEARSAL_DATABASE_URL || '').trim()
  if (!url) throw new Error('REHEARSAL_DATABASE_URL is required')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  if (!sqlIsAdditive(sql)) throw new Error('0003 is not additive')
  const sum = checksum(sql)

  const identity = spawnSync(
    process.execPath,
    ['scripts/migrate.js', '--rehearsal', '--identity-only', `--require-branch=${CHILD}`],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' },
  )
  process.stdout.write(identity.stdout || '')
  process.stderr.write(identity.stderr || '')
  if (identity.status !== 0) process.exit(identity.status || 1)

  const apply = spawnSync(
    process.execPath,
    [
      'scripts/migrate.js',
      '--rehearsal',
      `--require-branch=${CHILD}`,
      `--migration=0003_phase3_analytics.sql`,
      `--expected-checksum=${sum}`,
    ],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' },
  )
  process.stdout.write(apply.stdout || '')
  process.stderr.write(apply.stderr || '')
  if (apply.status !== 0) process.exit(apply.status || 1)

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  try {
    const ident = await client.query(`
      select current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id
    `)
    const row = ident.rows[0]
    if (row.project_id !== EXPECTED_PROJECT_ID) throw new Error('unexpected project')
    if (row.branch_id !== CHILD) throw new Error('not the rehearsal child')
    if (row.branch_id === PRIMARY_BRANCH_ID) throw new Error('refusing primary')

    const ledger = await client.query(
      `SELECT version, status FROM schema_migrations WHERE version = '0003_phase3_analytics.sql'`,
    )
    if (ledger.rows[0]?.status !== 'applied') throw new Error('0003 not applied on child')

    const user = await client.query(
      `INSERT INTO users (email, password)
       VALUES ('phase3-verify@parle.test', 'rehearsal-placeholder')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
    )
    const userId = user.rows[0]?.id
    if (!userId) throw new Error('could not create rehearsal user on child')

    const sessionKey = `sess-${Date.now()}`
    await client.query(
      `INSERT INTO product_events (name, user_id, is_guest, session_key)
       VALUES ('conversation_started', $1, false, $2)`,
      [userId, sessionKey],
    )
    let dupStarted = false
    try {
      await client.query(
        `INSERT INTO product_events (name, user_id, is_guest, session_key)
         VALUES ('conversation_started', $1, false, $2)`,
        [userId, sessionKey],
      )
    } catch (error) {
      dupStarted = error.code === '23505'
    }

    await client.query(
      `INSERT INTO product_events (name, user_id, is_guest, session_key)
       VALUES ('conversation_started', $1, false, $2)`,
      [userId, `${sessionKey}-b`],
    )

    let dupActivated = false
    try {
      await client.query(
        `INSERT INTO product_events (name, user_id, is_guest)
         VALUES ('user_activated', $1, false)`,
        [userId],
      )
    } catch (error) {
      if (error.code !== '23505') throw error
    }
    try {
      await client.query(
        `INSERT INTO product_events (name, user_id, is_guest)
         VALUES ('user_activated', $1, false)`,
        [userId],
      )
    } catch (error) {
      dupActivated = error.code === '23505'
    }

    const shownKey = `shown-${Date.now()}`
    try {
      await client.query(
        `INSERT INTO product_events (name, user_id, is_guest, session_key)
         VALUES ('survey_shown', $1, false, $2)`,
        [userId, shownKey],
      )
    } catch (error) {
      if (error.code !== '23505') throw error
    }
    let dupShown = false
    try {
      await client.query(
        `INSERT INTO product_events (name, user_id, is_guest, session_key)
         VALUES ('survey_shown', $1, false, $2)`,
        [userId, `${shownKey}-2`],
      )
    } catch (error) {
      dupShown = error.code === '23505'
    }

    await client.query(
      `INSERT INTO product_events (name, user_id, is_guest, session_key)
       VALUES ('message_sent', $1, false, $2)`,
      [userId, sessionKey],
    )
    await client.query(
      `INSERT INTO product_events (name, user_id, is_guest, session_key)
       VALUES ('message_sent', $1, false, $2)`,
      [userId, sessionKey],
    )

    await client.query(
      `INSERT INTO product_events (name, is_guest, session_key)
       VALUES ('message_sent', true, NULL), ('message_sent', true, NULL)`,
    )

    const nullSession = await client.query(
      `INSERT INTO product_events (name, user_id, is_guest, session_key)
       VALUES ('conversation_started', $1, false, NULL),
              ('conversation_started', $1, false, NULL)
       RETURNING id`,
      [userId],
    )

    const counts = await client.query(
      `SELECT name, COUNT(*)::int AS n FROM product_events WHERE user_id = $1 GROUP BY name`,
      [userId],
    )
    const byName = Object.fromEntries(counts.rows.map((r) => [r.name, r.n]))

    const d1 = await client.query(
      `SELECT COUNT(DISTINCT user_id)::int AS n
       FROM product_events
       WHERE name = 'message_sent' AND user_id IS NOT NULL`,
    )

    const indexes = await client.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE tablename = 'product_events'
       ORDER BY indexname`,
    )

    const retention = await client.query(
      `WITH cohorts AS (
         SELECT u.id, (u.first_activated_at AT TIME ZONE 'UTC')::date AS cohort_date
         FROM users u
         WHERE u.first_activated_at IS NOT NULL
           AND (u.first_activated_at AT TIME ZONE 'UTC')::date >= DATE '2026-10-20'
       ),
       matured AS (
         SELECT * FROM cohorts
         WHERE cohort_date <= ((now() AT TIME ZONE 'UTC')::date - 1)
       )
       SELECT
         (SELECT COUNT(*)::int FROM cohorts) AS verified_cohort_n,
         (SELECT COUNT(*)::int FROM matured) AS d1_matured_d,
         (SELECT COUNT(*)::int FROM users WHERE first_activated_at IS NOT NULL
            AND (first_activated_at AT TIME ZONE 'UTC')::date < DATE '2026-10-20') AS estimated_activation_n`,
    )

    const ledgerAll = await client.query(
      `SELECT version, status FROM schema_migrations ORDER BY version`,
    )

    console.log(
      JSON.stringify(
        {
          host: publicHost(url),
          branch_id: row.branch_id,
          checksum: sum,
          duplicateConversationStartedRejected: dupStarted,
          duplicateUserActivatedRejected: dupActivated,
          duplicateSurveyShownRejected: dupShown,
          nullableConversationStartedInserted: nullSession.rowCount,
          messageSentCount: byName.message_sent,
          conversationStartedCount: byName.conversation_started,
          verifiedActivityRows: d1.rows[0]?.n || 0,
          uniqueIndexes: indexes.rows.map((r) => r.indexname),
          retention: retention.rows[0],
          schemaMigrations: ledgerAll.rows,
          autoDeletionImplemented: false,
        },
        null,
        2,
      ),
    )
    if (!dupStarted) throw new Error('expected unique violation for duplicate conversation_started')
    if (!dupActivated) throw new Error('expected unique violation for duplicate user_activated')
    if (!dupShown) throw new Error('expected unique violation for duplicate survey_shown same UTC day')
    if ((nullSession.rowCount || 0) < 2) {
      throw new Error('nullable session_key conversation_started must not be unique-constrained')
    }
    if ((byName.message_sent || 0) < 2) throw new Error('message_sent should not be unique-constrained')
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
