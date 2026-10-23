#!/usr/bin/env node
/**
 * Rehearse the production-0004 authorization bundle on the Neon child.
 * Never applies SQL to the primary. Never executes --execute-primary-0004.
 */
const { spawnSync } = require('child_process')
const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
const {
  loadEnvLocal,
  publicHost,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')
const {
  checksum,
  EXPECTED_0004_CHECKSUM,
  PRIMARY_AUTH_MIGRATION,
  sqlIsAdditive,
} = require('./migrate')

loadEnvLocal()

const CHILD = 'br-misty-recipe-apcj8oyo'
const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', PRIMARY_AUTH_MIGRATION), 'utf8')
const sum = checksum(sql)

function run(argv) {
  const result = spawnSync(process.execPath, ['scripts/migrate.js', ...argv], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env },
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
  return { name, ok: true, status: result.status }
}

async function primaryReadOnly() {
  const url = String(process.env.DATABASE_URL || '').trim()
  if (!url) throw new Error('DATABASE_URL is required for a read-only primary check')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  try {
    const ident = await client.query(`
      select current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id
    `)
    if (ident.rows[0].project_id !== EXPECTED_PROJECT_ID) throw new Error('unexpected project on DATABASE_URL')
    if (ident.rows[0].branch_id !== PRIMARY_BRANCH_ID) throw new Error('DATABASE_URL is not the audited primary')
    const verifiedCol = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at'
    `)
    const ledger = await client.query(`
      SELECT version, status FROM schema_migrations ORDER BY version
    `).catch(() => ({ rows: [] }))
    return {
      host: publicHost(url),
      branch_id: ident.rows[0].branch_id,
      emailVerifiedAtPresent: Boolean(verifiedCol.rows[0]),
      schemaMigrations: ledger.rows.map((row) => ({ version: row.version, status: row.status })),
      migration0004Recorded: ledger.rows.some((row) => String(row.version).includes('0004') && row.status === 'applied'),
    }
  } finally {
    await client.end()
  }
}

async function neonRecovery() {
  const token = String(process.env.NEON_API_KEY || process.env.NEON_API_TOKEN || '').trim()
  if (!token) {
    return {
      api: false,
      path: 'Neon console PITR / branch restore of br-morning-sun-apghun9g. Rehearsal child is not a production restore target.',
    }
  }
  const res = await fetch(`https://console.neon.tech/api/v2/projects/${EXPECTED_PROJECT_ID}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) return { api: true, error: res.status }
  const project = await res.json()
  const seconds = project.project?.history_retention_seconds
  return {
    api: true,
    historyRetentionSeconds: seconds,
    historyRetentionHours: seconds ? Math.round(seconds / 3600) : null,
    restorePath: 'Neon point-in-time restore of primary branch br-morning-sun-apghun9g',
  }
}

async function main() {
  if (sum !== EXPECTED_0004_CHECKSUM) {
    throw new Error(`on-disk 0004 checksum ${sum} != approved ${EXPECTED_0004_CHECKSUM}`)
  }
  if (!sqlIsAdditive(sql)) {
    throw new Error('0004 is not additive')
  }

  const auth = [
    '--authorize-primary-additive',
    `--migration=${PRIMARY_AUTH_MIGRATION}`,
    `--expected-checksum=${EXPECTED_0004_CHECKSUM}`,
    `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
  ]

  const rows = []
  rows.push(
    expectFail(
      'child_wrong_checksum',
      [
        '--rehearsal',
        '--rehearse-primary-authorization',
        '--authorize-primary-additive',
        `--migration=${PRIMARY_AUTH_MIGRATION}`,
        '--expected-checksum=deadbeef',
        `--require-branch=${CHILD}`,
        `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
      ],
      /approved 0004 hash|Checksum mismatch/,
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
        `--expected-checksum=${EXPECTED_0004_CHECKSUM}`,
        `--require-branch=${CHILD}`,
        `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
      ],
      /only 0003_phase3_analytics\.sql|only 0004_auth_identities\.sql|authorized additive/,
    ),
  )
  rows.push(
    expectFail(
      'child_forbids_0002',
      [
        '--rehearsal',
        '--rehearse-primary-authorization',
        '--authorize-primary-additive',
        '--migration=0002_archive_legacy.sql',
        `--expected-checksum=${EXPECTED_0004_CHECKSUM}`,
        `--require-branch=${CHILD}`,
        `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
      ],
      /only 0003_phase3_analytics\.sql|only 0004_auth_identities\.sql|authorized additive/,
    ),
  )
  rows.push(
    expectFail(
      'child_forbids_execute_with_rehearsal',
      [
        '--rehearsal',
        '--rehearse-primary-authorization',
        '--execute-primary-0004',
        ...auth,
        `--require-branch=${CHILD}`,
      ],
      /execute-primary-0004 with rehearsal/,
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
      /SKIP_APPLIED 0004_auth_identities\.sql/,
    ),
  )
  rows.push(
    expectPass(
      'child_dry_run_skip_applied',
      [
        '--rehearsal',
        '--dry-run',
        `--migration=${PRIMARY_AUTH_MIGRATION}`,
        `--expected-checksum=${EXPECTED_0004_CHECKSUM}`,
        `--require-branch=${CHILD}`,
      ],
      /SKIP_APPLIED 0004_auth_identities\.sql/,
    ),
  )
  rows.push(
    expectFail(
      'primary_execution_disabled',
      [
        '--authorize-primary-additive',
        `--migration=${PRIMARY_AUTH_MIGRATION}`,
        `--expected-checksum=${EXPECTED_0004_CHECKSUM}`,
        `--require-branch=${PRIMARY_BRANCH_ID}`,
      ],
      /Primary execution is disabled/,
    ),
  )
  rows.push(expectPass('primary_identity_only', ['--identity-only'], /IDENTITY_ONLY=ok/))

  const primary = await primaryReadOnly()
  if (primary.migration0004Recorded || primary.emailVerifiedAtPresent) {
    throw new Error('primary already has 0004; this rehearsal must not apply it')
  }

  const recovery = await neonRecovery()

  console.log(
    JSON.stringify(
      {
        checksum: sum,
        additive: true,
        child: CHILD,
        intendedPrimary: PRIMARY_BRANCH_ID,
        rows,
        primaryReadOnly: primary,
        recovery,
        executePrimary0004: false,
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
