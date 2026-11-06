const http = require('http')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
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

function warmup(pathName) {
  return new Promise((resolve) => {
    const req = http.get(`${ORIGIN}${pathName}`, (res) => {
      res.resume()
      resolve()
    })
    req.on('error', resolve)
    req.setTimeout(60_000, () => {
      req.destroy()
      resolve()
    })
  })
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing')
  const cwd = path.join(__dirname, '..')
  for (const script of [
    'scripts/seed-test-users.js',
    'scripts/seed-v2d4-recovery-fixture.js',
    'scripts/seed-v2d5-access-fixture.js',
  ]) {
    spawnSync(process.execPath, [script], { cwd, env: process.env, stdio: 'inherit' })
  }

  const db = require('../lib/db')
  const emails = [
    'testuser_a@parle.test',
    'testuser_b@parle.test',
    'testuser_d4@parle.test',
    'testuser_d5_legacyonly@parle.test',
    'testuser_d5_incomplete@parle.test',
  ]
  const sessionUsers = await db.query(`SELECT id, email FROM users WHERE email = ANY($1)`, [emails])
  const byEmail = Object.fromEntries(sessionUsers.rows.map((row) => [row.email, row]))
  const token = (email) => {
    const user = byEmail[email]
    return user ? signToken({ id: user.id, email: user.email }) : ''
  }

  const child = spawn(
    process.execPath,
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd,
      env: {
        ...process.env,
        PORT: String(PORT),
        APP_URL: ORIGIN,
        PARLE_V2_TEST_STUB: '1',
        PARLE_V2_WRITES: '1',
        NEXT_PUBLIC_PARLE_V2_SURFACE: '1',
        PARLE_V2_SKIP_DAILY: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
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
    await Promise.all(['/api/health', '/chat', '/journal', '/login'].map(warmup))
    const env = {
      ...process.env,
      PLAYWRIGHT_BASE_URL: ORIGIN,
      PARLE_V2_TEST_STUB: '1',
        PARLE_V2_WRITES: '1',
        NEXT_PUBLIC_PARLE_V2_SURFACE: '1',
      TEST_PARLE_SESSION_A: token('testuser_a@parle.test'),
      TEST_PARLE_SESSION_B: token('testuser_b@parle.test'),
      TEST_PARLE_SESSION_D4: token('testuser_d4@parle.test'),
      TEST_PARLE_SESSION_D5_LEGACYONLY: token('testuser_d5_legacyonly@parle.test'),
      TEST_PARLE_SESSION_D5_INCOMPLETE: token('testuser_d5_incomplete@parle.test'),
    }
    const ah = spawnSync(
      process.execPath,
      [
        path.join('node_modules', '@playwright', 'test', 'cli.js'),
        'test',
        'tests/e2e/v2-conversations.spec.js',
        '--project=chromium',
        '--project=mobile',
      ],
      { cwd, env, encoding: 'utf8' },
    )
    process.stdout.write(ah.stdout || '')
    process.stderr.write(ah.stderr || '')
    if (ah.status !== 0) {
      process.stderr.write(nextLog.slice(-3000))
      process.exit(ah.status == null ? 1 : ah.status)
    }
    const access = spawnSync(
      process.execPath,
      [
        path.join('node_modules', '@playwright', 'test', 'cli.js'),
        'test',
        'tests/e2e/v2-d5-access.spec.js',
        '--project=chromium',
        '--project=mobile',
      ],
      { cwd, env, encoding: 'utf8' },
    )
    process.stdout.write(access.stdout || '')
    process.stderr.write(access.stderr || '')
    if (access.status !== 0) {
      process.stderr.write(nextLog.slice(-3000))
      process.exit(access.status == null ? 1 : access.status)
    }
  } finally {
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
    await db.pool.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error(String(error.message || error).slice(0, 400))
  process.exit(1)
})
