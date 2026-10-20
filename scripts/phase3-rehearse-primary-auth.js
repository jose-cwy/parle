#!/usr/bin/env node
/**
 * Rehearse the production-0003 authorization bundle on the Neon child.
 * Never applies SQL to the primary. Never bootstraps the primary ledger.
 */
const { spawnSync } = require('child_process')
const { Client } = require('pg')
const {
  loadEnvLocal,
  publicHost,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')
const { checksum, EXPECTED_0003_CHECKSUM, PRIMARY_ADDITIVE_MIGRATION } = require('./migrate')
const fs = require('fs')
const path = require('path')

loadEnvLocal()

const CHILD = 'br-misty-recipe-apcj8oyo'
const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', PRIMARY_ADDITIVE_MIGRATION))
const sum = checksum(sql)

function run(argv, extraEnv = {}) {
  const result = spawnSync(process.execPath, ['scripts/migrate.js', ...argv], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  })
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    combined: `${result.stdout || ''}\n${result.stderr || ''}`,
  }
}

function expectFail(name, argv, pattern) {
  const result = run(argv)
  const ok = result.status !== 0 && pattern.test(result.combined)
  if (!ok) {
    throw new Error(`${name} expected to fail matching ${pattern}: ${result.combined.slice(-800)}`)
  }
  return { name, ok: true, status: result.status }
}

function expectPass(name, argv, pattern) {
  const result = run(argv)
  const ok = result.status === 0 && pattern.test(result.combined)
  if (!ok) {
    throw new Error(`${name} expected to pass matching ${pattern}: ${result.combined.slice(-800)}`)
  }
  return { name, ok: true, status: result.status, stdout: result.stdout }
}

async function primaryLedgerAbsent() {
  const url = String(process.env.DATABASE_URL || '').trim()
  if (!url) throw new Error('DATABASE_URL is required for a read-only primary ledger check')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  try {
    const ident = await client.query(`
      select current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id
    `)
    if (ident.rows[0].project_id !== EXPECTED_PROJECT_ID) throw new Error('unexpected project on DATABASE_URL')
    if (ident.rows[0].branch_id !== PRIMARY_BRANCH_ID) throw new Error('DATABASE_URL is not the audited primary')
    const table = await client.query(`SELECT to_regclass('public.schema_migrations') AS name`)
    const events = await client.query(`SELECT to_regclass('public.product_events') AS name`)
    const activated = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'first_activated_at'
    `)
    return {
      host: publicHost(url),
      branch_id: ident.rows[0].branch_id,
      schemaMigrations: table.rows[0]?.name || null,
      productEvents: events.rows[0]?.name || null,
      usersFirstActivatedAt: Boolean(activated.rows[0]),
    }
  } finally {
    await client.end()
  }
}

async function main() {
  if (sum !== EXPECTED_0003_CHECKSUM) {
    throw new Error(`on-disk 0003 checksum ${sum} != approved ${EXPECTED_0003_CHECKSUM}`)
  }

  const rows = []
  const auth = [
    '--authorize-primary-additive',
    `--migration=${PRIMARY_ADDITIVE_MIGRATION}`,
    `--expected-checksum=${EXPECTED_0003_CHECKSUM}`,
    `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
  ]

  rows.push(
    expectFail(
      'child_wrong_checksum',
      [
        '--rehearsal',
        '--rehearse-primary-authorization',
        ...auth.slice(0, 2),
        '--expected-checksum=deadbeef',
        `--require-branch=${CHILD}`,
        `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
      ],
      /approved 0003 hash|Checksum mismatch/,
    ),
  )
  rows.push(
    expectFail(
      'child_forbids_0001',
      [
        '--rehearsal',
        '--rehearse-primary-authorization',
        '--authorize-primary-additive',
        '--migration=0001_keep_comments.sql',
        `--expected-checksum=${EXPECTED_0003_CHECKSUM}`,
        `--require-branch=${CHILD}`,
        `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
      ],
      /only 0003_phase3_analytics\.sql|authorized additive/,
    ),
  )
  rows.push(
    expectFail(
      'child_forbids_execute_with_rehearsal',
      [
        '--rehearsal',
        '--rehearse-primary-authorization',
        '--execute-primary-0003',
        ...auth,
        `--require-branch=${CHILD}`,
      ],
      /execute-primary-0003 with rehearsal/,
    ),
  )
  rows.push(
    expectPass(
      'child_authorized_skip_applied',
      [
        '--rehearsal',
        '--rehearse-primary-authorization',
        ...auth,
        `--require-branch=${CHILD}`,
      ],
      /SKIP_APPLIED 0003_phase3_analytics\.sql/,
    ),
  )
  rows.push(
    expectFail(
      'primary_execution_disabled',
      [
        '--authorize-primary-additive',
        `--migration=${PRIMARY_ADDITIVE_MIGRATION}`,
        `--expected-checksum=${EXPECTED_0003_CHECKSUM}`,
        `--require-branch=${PRIMARY_BRANCH_ID}`,
      ],
      /Primary execution is disabled/,
    ),
  )
  rows.push(expectPass('primary_identity_only', ['--identity-only'], /IDENTITY_ONLY=ok/))

  const primary = await primaryLedgerAbsent()
  if (primary.schemaMigrations) {
    throw new Error('primary schema_migrations exists; rehearsal must not bootstrap the ledger')
  }
  if (primary.productEvents) {
    throw new Error('primary already has product_events; production 0003 appears applied')
  }
  if (primary.usersFirstActivatedAt) {
    throw new Error('primary users.first_activated_at exists; production 0003 appears applied')
  }

  console.log(
    JSON.stringify(
      {
        checksum: sum,
        child: CHILD,
        intendedPrimary: PRIMARY_BRANCH_ID,
        rows,
        primaryReadOnly: primary,
        executePrimary0003: false,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
