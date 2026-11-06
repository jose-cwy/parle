/**
 * Rehearsal-only HTTP gate for V2 generation control.
 * Starts Next against REHEARSAL_DATABASE_URL. Does not touch primary.
 */
const http = require('http')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')

loadEnvLocal()

const PORT = Number(process.env.V2_HTTP_PORT || 3055)
const ORIGIN = `http://127.0.0.1:${PORT}`
const ADMIN_EMAIL = process.env.V2F_HTTP_ADMIN_EMAIL || `v2f-http-admin-${Date.now()}@parle.chat`

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
        if (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 404) {
          resolve()
          return
        }
        retry()
      })
      req.on('error', retry)
      req.setTimeout(2000, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error('next did not become ready'))
        return
      }
      setTimeout(tick, 500)
    }
    tick()
  })
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing; run via scripts/run-with-rehearsal.js')
  }

  const child = spawn(
    process.execPath,
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        APP_URL: ORIGIN,
        PARLE_V2_OPS_CONTROL: '1',
        PARLE_V2_TEST_STUB: '1',
        PARLE_V2_SKIP_DAILY: '1',
        PARLE_V2_RECOVERY: '',
        ADMIN_EMAILS: ADMIN_EMAIL,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let nextLog = ''
  child.stdout.on('data', (chunk) => {
    nextLog += String(chunk)
  })
  child.stderr.on('data', (chunk) => {
    nextLog += String(chunk)
  })

  try {
    await waitForServer(child)
    const result = spawnSync(
      process.execPath,
      ['--test', '--test-concurrency=1', 'tests/api/v2GenerationControl.http.test.js'],
      {
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          RUN_V2_OPS_HTTP: '1',
          TEST_API_BASE: ORIGIN,
          V2F_HTTP_ADMIN_EMAIL: ADMIN_EMAIL,
          ADMIN_EMAILS: ADMIN_EMAIL,
          PARLE_V2_OPS_CONTROL: '1',
          PARLE_V2_TEST_STUB: '1',
          PARLE_V2_SKIP_DAILY: '1',
        },
        encoding: 'utf8',
      },
    )
    process.stdout.write(result.stdout || '')
    process.stderr.write(result.stderr || '')
    if (result.status !== 0) {
      process.stderr.write(nextLog.slice(-4000))
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
