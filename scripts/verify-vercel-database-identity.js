#!/usr/bin/env node
/**
 * Confirm Vercel Production DATABASE_URL identity without printing the URL.
 * Uses VERCEL_TOKEN + VERCEL_PROJECT_ID, or `vercel env pull` into a temp file.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { Client } = require('pg')
const {
  loadEnvLocal,
  publicHost,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')

function parseEnvFile(raw) {
  const out = {}
  for (const line of String(raw).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[trimmed.slice(0, eq).trim()] = value
  }
  return out
}

async function identityOf(url, label) {
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
    return {
      label,
      host: publicHost(url),
      db: row.db,
      project_id: row.project_id,
      branch_id: row.branch_id,
      endpoint_id: row.endpoint_id,
    }
  } finally {
    await client.end().catch(() => {})
  }
}

async function urlFromVercelApi() {
  const token = String(process.env.VERCEL_TOKEN || '').trim()
  const projectId = String(process.env.VERCEL_PROJECT_ID || '').trim()
  const teamId = String(process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '').trim()
  if (!token || !projectId) return null
  const query = new URLSearchParams({ decrypt: 'true' })
  if (teamId) query.set('teamId', teamId)
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${projectId}/env?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) {
    throw new Error(`Vercel env API ${res.status}`)
  }
  const payload = await res.json()
  const envs = payload.envs || payload
  const match = (Array.isArray(envs) ? envs : []).find(
    (row) => row.key === 'DATABASE_URL' && (row.target || []).includes('production'),
  )
  if (!match || !match.value) {
    throw new Error('Production DATABASE_URL not found in Vercel env API')
  }
  return match.value
}

function urlFromVercelCli() {
  const tmp = path.join(os.tmpdir(), `parle-vercel-prod-env-${Date.now()}`)
  const result = spawnSync(
    'npx',
    [
      '--yes',
      'vercel',
      'env',
      'pull',
      tmp,
      '--environment',
      'production',
      '--yes',
      '--scope',
      'josz',
      '--project',
      'parle',
    ],
    { encoding: 'utf8', timeout: 25000, shell: true },
  )
  try {
    if (result.status !== 0 || !fs.existsSync(tmp)) {
      return { error: `vercel env pull failed (${result.status})` }
    }
    const parsed = parseEnvFile(fs.readFileSync(tmp, 'utf8'))
    if (!parsed.DATABASE_URL) return { error: 'pulled env has no DATABASE_URL' }
    return { url: parsed.DATABASE_URL }
  } finally {
    fs.rmSync(tmp, { force: true })
  }
}

async function main() {
  loadEnvLocal()
  let url = null
  let source = null
  try {
    url = await urlFromVercelApi()
    if (url) source = 'vercel_api'
  } catch (error) {
    console.log(JSON.stringify({ vercel_api: 'error', detail: String(error.message || error) }))
  }
  if (!url) {
    const pulled = urlFromVercelCli()
    if (pulled.url) {
      url = pulled.url
      source = 'vercel_cli_pull'
    } else {
      console.log(JSON.stringify({ vercel_cli: pulled.error || 'unavailable' }))
    }
  }
  if (!url) {
    console.log(JSON.stringify({
      ok: false,
      reason: 'Could not read Vercel production DATABASE_URL (no token/login)',
    }))
    process.exit(2)
  }

  const ident = await identityOf(url, 'vercel_production')
  const matches =
    ident.project_id === EXPECTED_PROJECT_ID && ident.branch_id === PRIMARY_BRANCH_ID
  console.log(JSON.stringify({
    ok: matches,
    source,
    ...ident,
    expected_project_id: EXPECTED_PROJECT_ID,
    expected_branch_id: PRIMARY_BRANCH_ID,
  }))
  if (!matches) process.exit(1)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
