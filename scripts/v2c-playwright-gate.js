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

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing')
  const seed = spawnSync(process.execPath, ['scripts/seed-test-users.js'], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    encoding: 'utf8',
  })
  process.stdout.write(seed.stdout || '')
  process.stderr.write(seed.stderr || '')

  const db = require('../lib/db')
  const sessionUsers = await db.query(
    `SELECT id, email FROM users WHERE email = ANY($1)`,
    [['testuser_a@parle.test', 'testuser_b@parle.test']],
  )
  const sessionA = sessionUsers.rows.find((row) => row.email === 'testuser_a@parle.test')
  const sessionB = sessionUsers.rows.find((row) => row.email === 'testuser_b@parle.test')
  const tokenA = sessionA ? signToken({ id: sessionA.id, email: sessionA.email }) : ''
  const tokenB = sessionB ? signToken({ id: sessionB.id, email: sessionB.email }) : ''

  const child = spawn(
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
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let nextLog = ''
  child.stdout.on('data', (chunk) => {
    const text = String(chunk)
    nextLog += text
    process.stderr.write(text)
  })
  child.stderr.on('data', (chunk) => {
    const text = String(chunk)
    nextLog += text
    process.stderr.write(text)
  })

  try {
    await waitForServer(child)
    await Promise.all(
      ['/api/health', '/chat', '/journal'].map(
        (pathName) =>
          new Promise((resolve) => {
            const req = http.get(`${ORIGIN}${pathName}`, (res) => {
              res.resume()
              resolve()
            })
            req.on('error', resolve)
            req.setTimeout(60_000, () => {
              req.destroy()
              resolve()
            })
          }),
      ),
    )
    const result = spawnSync(
      process.execPath,
      [
        path.join('node_modules', '@playwright', 'test', 'cli.js'),
        'test',
        'tests/e2e/v2-conversations.spec.js',
        '--project=chromium',
        '--project=mobile',
      ],
      {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: ORIGIN,
          PARLE_V2_TEST_STUB: '1',
          TEST_PARLE_SESSION_A: tokenA,
          TEST_PARLE_SESSION_B: tokenB,
        },
        encoding: 'utf8',
      },
    )
    process.stdout.write(result.stdout || '')
    process.stderr.write(result.stderr || '')
    if (result.status !== 0) {
      process.stderr.write(nextLog.slice(-3000))
      process.exit(result.status == null ? 1 : result.status)
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
