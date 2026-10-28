/**
 * Run a command with DATABASE_URL forced to REHEARSAL_DATABASE_URL.
 * Refuses to start unless the Neon branch is the verified development child.
 * Never prints connection strings.
 */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { Client } = require('pg')
const { PRIMARY_BRANCH_ID, EXPECTED_PROJECT_ID } = require('./rehearsalEnv')

const REQUIRED_BRANCH = 'br-square-unit-apbswjj3'
const OLD_REHEARSAL = 'br-misty-recipe-apcj8oyo'

function rehearsalUrl() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    if (trimmed.slice(0, eq).trim() !== 'REHEARSAL_DATABASE_URL') continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value
  }
  throw new Error('REHEARSAL_DATABASE_URL missing from .env.local')
}

async function assertBranch(url) {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  try {
    const result = await client.query(`
      select current_setting('neon.project_id', true) as project_id,
             current_setting('neon.branch_id', true) as branch_id
    `)
    const row = result.rows[0] || {}
    if (row.project_id !== EXPECTED_PROJECT_ID) {
      throw new Error(`unexpected project ${row.project_id}`)
    }
    if (row.branch_id === PRIMARY_BRANCH_ID || row.branch_id === OLD_REHEARSAL) {
      throw new Error(`refusing primary/old rehearsal branch ${row.branch_id}`)
    }
    if (row.branch_id !== REQUIRED_BRANCH) {
      throw new Error(`refusing unverified branch ${row.branch_id}`)
    }
    process.stderr.write(`REHEARSAL_IDENTITY=${row.branch_id}\n`)
  } finally {
    await client.end().catch(() => {})
  }
}

async function main() {
  const extraEnv = {}
  const command = []
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--env:')) {
      const eq = arg.indexOf('=', 6)
      if (eq > 6) extraEnv[arg.slice(6, eq)] = arg.slice(eq + 1)
    } else {
      command.push(arg)
    }
  }
  if (!command.length) {
    throw new Error('usage: node scripts/run-with-rehearsal.js [--env:KEY=val] <cmd>...')
  }
  const url = rehearsalUrl()
  await assertBranch(url)
  const child = spawn(command[0], command.slice(1), {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url, ...extraEnv },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  child.on('exit', (code, signal) => {
    process.exit(signal ? 1 : code == null ? 1 : code)
  })
}

main().catch((error) => {
  console.error(String(error.message || error).slice(0, 200))
  process.exit(1)
})
