#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { Client } = require('pg')
const { loadEnvLocal, publicHost, PRIMARY_BRANCH_ID, EXPECTED_PROJECT_ID } = require('./rehearsalEnv')
const {
  checksum,
  sqlIsAdditive,
  EXPECTED_0003_CHECKSUM,
  PRIMARY_ADDITIVE_MIGRATION,
} = require('./migrate')

loadEnvLocal()

async function identityOf(url) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  try {
    const result = await client.query(`
      select current_database() as db,
             current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id,
             current_setting('neon.endpoint_id', true) as endpoint_id
    `)
    return { host: publicHost(url), ...result.rows[0] }
  } finally {
    await client.end().catch(() => {})
  }
}

function vercelDatabaseUrl() {
  const result = spawnSync(
    'npx',
    [
      '--yes',
      'vercel',
      'env',
      'get',
      'DATABASE_URL',
      '--environment',
      'production',
      '--scope',
      'josz',
      '--project',
      'parle',
      '--yes',
    ],
    { encoding: 'utf8', timeout: 90000, shell: true },
  )
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`
  const match = combined.match(/postgres(?:ql)?:\/\/\S+/i)
  if (!match) {
    return { error: `vercel env get failed (${result.status})` }
  }
  return { url: match[0].replace(/["']+$/, '') }
}

async function neonRecovery() {
  const token = String(process.env.NEON_API_KEY || process.env.NEON_API_TOKEN || '').trim()
  if (!token) {
    return {
      api: false,
      path: 'Neon console PITR / branch restore of br-morning-sun-apghun9g; app rollback to recorded dpl; rehearsal child is not a live PITR substitute',
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
    restorePath: 'Neon point-in-time restore of primary branch',
  }
}

async function baseline(url) {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: true } })
  await client.connect()
  try {
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM users WHERE email ILIKE '%@parle.test') AS test_users,
        (SELECT COUNT(*)::int FROM users WHERE admin IS TRUE) AS flagged_admin,
        (SELECT COUNT(*)::int FROM chat_memory) AS chat_memory,
        (SELECT COUNT(*)::int FROM message_feedback) AS message_feedback,
        (SELECT COUNT(*)::int FROM product_feedback) AS product_feedback,
        (SELECT to_regclass('public.schema_migrations') IS NOT NULL) AS has_ledger,
        (SELECT to_regclass('public.product_events') IS NOT NULL) AS has_events
    `)
    const col = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='first_activated_at'
    `)
    const founder = await client.query(`
      SELECT email FROM users
      WHERE email NOT ILIKE '%@parle.test'
      ORDER BY created_at ASC NULLS LAST
      LIMIT 5
    `)
    return {
      counts: counts.rows[0],
      hasFirstActivated: Boolean(col.rows[0]),
      founderDomains: founder.rows.map((row) => String(row.email).split('@')[1] || ''),
      founderEmails: founder.rows.map((row) => row.email),
    }
  } finally {
    await client.end()
  }
}

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'database', 'migrations', PRIMARY_ADDITIVE_MIGRATION),
  )
  const hex = checksum(sql)
  const text = sql.toString('utf8')
  const sqlOk =
    hex === EXPECTED_0003_CHECKSUM &&
    sqlIsAdditive(text) &&
    !/\bDROP\s+(TABLE|SCHEMA|DATABASE|COLUMN)\b/i.test(text)

  const local = await identityOf(process.env.DATABASE_URL)
  const pulled = vercelDatabaseUrl()
  let vercelIdent = null
  if (pulled.url) vercelIdent = await identityOf(pulled.url)

  const recovery = await neonRecovery()
  const base = await baseline(process.env.DATABASE_URL)

  const vercelOk =
    vercelIdent &&
    vercelIdent.project_id === EXPECTED_PROJECT_ID &&
    vercelIdent.branch_id === PRIMARY_BRANCH_ID &&
    vercelIdent.db === 'neondb'
  const localOk =
    local.project_id === EXPECTED_PROJECT_ID &&
    local.branch_id === PRIMARY_BRANCH_ID &&
    local.db === 'neondb'

  const report = {
    sqlOk,
    checksum: hex,
    local: { ok: localOk, ...local },
    vercel: pulled.error
      ? { ok: false, error: pulled.error }
      : { ok: Boolean(vercelOk), ...vercelIdent },
    recovery,
    baseline: {
      counts: base.counts,
      hasFirstActivated: base.hasFirstActivated,
      founderDomains: base.founderDomains,
    },
    rollbackDeployment: 'dpl_GYiiBkkJFonShWG4TEa3Kj514gch',
  }
  console.log(JSON.stringify(report, null, 2))
  if (base.founderEmails.length) {
    fs.writeFileSync(
      path.join(osTmp(), 'parle-admin-emails.txt'),
      base.founderEmails.filter((email) => !String(email).toLowerCase().endsWith('@parle.test')).join(','),
      { encoding: 'utf8', mode: 0o600 },
    )
  }
  if (!sqlOk || !localOk || !vercelOk) process.exit(1)
}

function osTmp() {
  return require('os').tmpdir()
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
