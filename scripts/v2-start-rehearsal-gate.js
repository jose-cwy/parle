/**
 * Production-like rehearsal gate: next build + next start.
 * Does not enable PARLE_V2_TEST_STUB on the server. NODE_ENV=production
 * ignores that flag even if a caller sets it.
 */
const http = require('http')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { signToken } = require('../lib/auth')
const { resolveV2StreamFn } = require('../lib/parle/v2TestStream')

loadEnvLocal()

const PORT = Number(process.env.V2_HTTP_PORT || 3082)
const ORIGIN = `http://127.0.0.1:${PORT}`
const PHASE = process.env.PARLE_V2_GATE_PHASE || 'mobile-a'
const REQUIRED_BRANCH = 'br-square-unit-apbswjj3'

function waitForServer(child, timeoutMs = 120_000) {
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
        reject(new Error('next start did not become ready'))
        return
      }
      setTimeout(tick, 400)
    }
    tick()
  })
}

function warmup(pathName) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const req = http.get(`${ORIGIN}${pathName}`, (res) => {
      res.resume()
      if (res.statusCode && res.statusCode >= 500) {
        reject(new Error(`${pathName} ${res.statusCode}`))
        return
      }
      process.stderr.write(`WARMUP ${pathName} ${res.statusCode} ${Date.now() - started}ms\n`)
      resolve()
    })
    req.on('error', reject)
    req.setTimeout(60_000, () => {
      req.destroy()
      reject(new Error(`warmup timeout ${pathName}`))
    })
  })
}

function runPlaywright(args, env) {
  return spawnSync(
    process.execPath,
    [path.join('node_modules', '@playwright', 'test', 'cli.js'), 'test', ...args],
    { cwd: path.join(__dirname, '..'), env, encoding: 'utf8' },
  )
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing')
  const cwd = path.join(__dirname, '..')

  const stubInProduction = resolveV2StreamFn(
    { headers: { 'x-parle-v2-stub': 'ok' }, body: { testStub: 'ok' } },
    { NODE_ENV: 'production', PARLE_V2_TEST_STUB: '1' },
  )
  process.stderr.write(
    `STUB_GUARD production_stub_fn=${stubInProduction ? 'ENABLED_BUG' : 'disabled'}\n`,
  )
  if (stubInProduction) throw new Error('production stub guard failed')

  spawnSync(process.execPath, ['scripts/seed-test-users.js'], {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })

  const db = require('../lib/db')
  const ident = await db.query(
    `SELECT current_setting('neon.project_id', true) AS project_id,
            current_setting('neon.branch_id', true) AS branch_id`,
  )
  const branchId = ident.rows[0]?.branch_id
  process.stderr.write(`REHEARSAL_IDENTITY=${branchId}\n`)
  if (branchId !== REQUIRED_BRANCH) {
    throw new Error(`refusing branch ${branchId}`)
  }

  const emails = ['testuser_a@parle.test', 'testuser_b@parle.test', 'testuser_persist@parle.test']
  const sessionUsers = await db.query(`SELECT id, email FROM users WHERE email = ANY($1)`, [emails])
  const byEmail = Object.fromEntries(sessionUsers.rows.map((row) => [row.email, row]))
  const token = (email) => {
    const user = byEmail[email]
    return user ? signToken({ id: user.id, email: user.email }) : ''
  }

  if (process.env.PARLE_V2_SKIP_BUILD === '1') {
    process.stderr.write('NEXT_BUILD skipped\n')
  } else {
    process.stderr.write('NEXT_BUILD starting\n')
    const built = spawnSync(
      process.execPath,
      [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
      {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          APP_URL: ORIGIN,
        },
        encoding: 'utf8',
      },
    )
    process.stdout.write(built.stdout || '')
    process.stderr.write(built.stderr || '')
    if (built.status !== 0) {
      throw new Error(`next build failed ${built.status}`)
    }
    process.stderr.write('NEXT_BUILD ok\n')
  }

  const child = spawn(
    process.execPath,
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PORT),
        APP_URL: ORIGIN,
        PARLE_V2_TEST_STUB: '',
        PARLE_V2_SKIP_DAILY: '',
        PARLE_V2_RECOVERY: '',
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

  const pwEnv = {
    ...process.env,
    PLAYWRIGHT_BASE_URL: ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
    TEST_PARLE_SESSION_A: token('testuser_a@parle.test'),
    TEST_PARLE_SESSION_B: token('testuser_b@parle.test'),
    TEST_PARLE_SESSION_PERSIST: token('testuser_persist@parle.test'),
  }
  delete pwEnv.PARLE_V2_TEST_STUB

  try {
    await waitForServer(child)
    await warmup('/api/health')
    await warmup('/chat')
    await warmup('/login')

    const liveIdent = await db.query(
      `SELECT current_setting('neon.branch_id', true) AS branch_id`,
    )
    process.stderr.write(`SERVER_DB_BRANCH=${liveIdent.rows[0]?.branch_id}\n`)
    process.stderr.write(`SERVER_NODE_ENV=production PORT=${PORT} PHASE=${PHASE}\n`)

    const run = (args) => {
      const result = runPlaywright(args, pwEnv)
      process.stdout.write(result.stdout || '')
      process.stderr.write(result.stderr || '')
      return result.status == null ? 1 : result.status
    }

    const fail = (status) => {
      process.stderr.write(nextLog.slice(-3000))
      process.exit(status)
    }

    if (PHASE === 'mobile-a' || PHASE === 'targeted') {
      const status = run([
        'tests/e2e/v2-mobile-a-trace.spec.js',
        'tests/e2e/v2-conversations.spec.js',
        '-g',
        'first New Chat POST|Chat 1 completes then Chat 2',
        '--project=mobile',
      ])
      if (status !== 0) fail(status)
      if (PHASE === 'mobile-a') process.exit(0)
    }

    if (PHASE === 'targeted') {
      const status = run([
        'tests/e2e/v2-persist-trace.spec.js',
        'tests/e2e/v2-conversations.spec.js',
        '-g',
        'Chat 1 completes then Chat 2|Chat 2 POST UUID|refresh during drip|refresh during streaming|archive Chat 2|two tabs send',
        '--project=chromium',
        '--project=mobile',
      ])
      if (status !== 0) fail(status)
      process.exit(0)
    }

    const status = run([
      'tests/e2e/v2-conversations.spec.js',
      '--project=chromium',
      '--project=mobile',
    ])
    if (status !== 0) {
      process.stderr.write(nextLog.slice(-3000))
      process.exit(status)
    }
  } finally {
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
}

main().catch((error) => {
  console.error(String(error.message || error).slice(0, 400))
  process.exit(1)
})
