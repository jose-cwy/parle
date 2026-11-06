const http = require('http')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { CURRENT_REHEARSAL_BRANCH } = require('./rehearsalEnv')
const { signToken } = require('../lib/auth')

loadEnvLocal()

const PORT = Number(process.env.V2_HTTP_PORT || 3075)
const ORIGIN = `http://127.0.0.1:${PORT}`

function waitForServer(child, timeoutMs = 90_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (child.exitCode != null) {
        reject(new Error(`next exited ${child.exitCode}`))
        return
      }
      const req = http.get(`${ORIGIN}/api/health`, (res) => {
        res.resume()
        if (res.statusCode === 200) {
          resolve()
          return
        }
        retry()
      })
      req.on('error', retry)
      req.setTimeout(1500, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error('next did not become ready'))
        return
      }
      setTimeout(tick, 400)
    }
    tick()
  })
}

function startNext(recovery) {
  return spawn(
    process.execPath,
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        APP_URL: ORIGIN,
        PARLE_V2_TEST_STUB: '1',
        PARLE_V2_SKIP_DAILY: '1',
        PARLE_V2_RECOVERY: recovery ? '1' : '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
}

async function mint() {
  const db = require('../lib/db')
  const sessionUsers = await db.query(
    `SELECT id, email FROM users WHERE email = ANY($1)`,
    [
      [
        'testuser_a@parle.test',
        'testuser_b@parle.test',
        'testuser_d4@parle.test',
        'testuser_d4_b@parle.test',
      ],
    ],
  )
  const byEmail = Object.fromEntries(sessionUsers.rows.map((row) => [row.email, row]))
  const token = (email) => {
    const user = byEmail[email]
    return user ? signToken({ id: user.id, email: user.email }) : ''
  }
  return {
    db,
    env: {
      TEST_PARLE_SESSION_A: token('testuser_a@parle.test'),
      TEST_PARLE_SESSION_B: token('testuser_b@parle.test'),
      TEST_PARLE_SESSION_D4: token('testuser_d4@parle.test'),
      TEST_PARLE_SESSION_D4_B: token('testuser_d4_b@parle.test'),
    },
  }
}

function runPlaywright(extraEnv, args) {
  return spawnSync(
    process.execPath,
    [path.join('node_modules', '@playwright', 'test', 'cli.js'), 'test', ...args],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: ORIGIN,
        PARLE_V2_TEST_STUB: '1',
        ...extraEnv,
      },
      encoding: 'utf8',
    },
  )
}

async function withServer(recovery, fn) {
  const child = startNext(recovery)
  let nextLog = ''
  child.stdout.on('data', (chunk) => {
    nextLog += String(chunk)
    process.stderr.write(chunk)
  })
  child.stderr.on('data', (chunk) => {
    nextLog += String(chunk)
    process.stderr.write(chunk)
  })
  try {
    await waitForServer(child)
    return await fn()
  } finally {
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
    if (fn.failed) process.stderr.write(nextLog.slice(-3000))
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing')
  spawnSync(
    process.execPath,
    [
      'scripts/migrate.js',
      '--rehearsal',
      `--require-branch=${CURRENT_REHEARSAL_BRANCH}`,
      '--migration=0009_timeline_revision.sql',
    ],
    { cwd: path.join(__dirname, '..'), env: process.env, stdio: 'inherit' },
  )
  spawnSync(process.execPath, ['scripts/seed-v2d4-recovery-fixture.js'], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  })
  const { db, env } = await mint()
  try {
    let failed = false
    await withServer(true, async () => {
      const result = runPlaywright(env, [
        'tests/e2e/v2-recovery.spec.js',
        '--project=chromium',
        '--project=mobile',
      ])
      process.stdout.write(result.stdout || '')
      process.stderr.write(result.stderr || '')
      if (result.status !== 0) {
        failed = true
        process.exitCode = result.status == null ? 1 : result.status
      }
    })
    if (failed) return
    await withServer(false, async () => {
      const result = runPlaywright(env, [
        'tests/e2e/v2-conversations.spec.js',
        '--grep',
        'G: archive Chat 2 persists across refresh and Journal return',
        '--project=chromium',
      ])
      process.stdout.write(result.stdout || '')
      process.stderr.write(result.stderr || '')
      if (result.status !== 0) {
        process.exitCode = result.status == null ? 1 : result.status
      }
    })
  } finally {
    await db.pool.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error(String(error.message || error).slice(0, 400))
  process.exit(1)
})
