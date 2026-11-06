const http = require('http')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { signToken } = require('../lib/auth')

loadEnvLocal()

const PORT = Number(process.env.V2_HTTP_PORT || 3076)
const ORIGIN = `http://127.0.0.1:${PORT}`
const USE_START = process.env.PARLE_V2_USE_START === '1'

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
    req.setTimeout(90_000, () => {
      req.destroy()
      resolve()
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
  spawnSync(process.execPath, ['scripts/seed-test-users.js'], {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })

  const db = require('../lib/db')
  const emails = ['testuser_a@parle.test', 'testuser_b@parle.test', 'testuser_persist@parle.test']
  const sessionUsers = await db.query(`SELECT id, email FROM users WHERE email = ANY($1)`, [emails])
  const byEmail = Object.fromEntries(sessionUsers.rows.map((row) => [row.email, row]))
  const token = (email) => {
    const user = byEmail[email]
    return user ? signToken({ id: user.id, email: user.email }) : ''
  }

  const nextArgs = USE_START
    ? [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT), '-H', '127.0.0.1']
    : [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT), '-H', '127.0.0.1']

  const child = spawn(process.execPath, nextArgs, {
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
  })
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
      TEST_PARLE_SESSION_PERSIST: token('testuser_persist@parle.test'),
    }

    const focused = [
      'tests/e2e/v2-persist-trace.spec.js',
      'tests/e2e/v2-conversations.spec.js',
      '-g',
      'Chat 2 POST UUID|refresh during drip|refresh during streaming|archive Chat 2|Chat 1 completes then Chat 2',
    ]
    const projects = process.env.PARLE_V2_FOCUSED_PROJECT
      ? [`--project=${process.env.PARLE_V2_FOCUSED_PROJECT}`]
      : ['--project=chromium', '--project=mobile']

    const first = runPlaywright([...focused, ...projects], env)
    process.stdout.write(first.stdout || '')
    process.stderr.write(first.stderr || '')
    if (first.status !== 0) {
      process.stderr.write(nextLog.slice(-3000))
      process.exit(first.status == null ? 1 : first.status)
    }

    if (process.env.PARLE_V2_SKIP_FULL === '1') return

    const full = runPlaywright(
      ['tests/e2e/v2-conversations.spec.js', '--project=chromium', '--project=mobile'],
      env,
    )
    process.stdout.write(full.stdout || '')
    process.stderr.write(full.stderr || '')
    if (full.status !== 0) {
      process.stderr.write(nextLog.slice(-3000))
      process.exit(full.status == null ? 1 : full.status)
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
