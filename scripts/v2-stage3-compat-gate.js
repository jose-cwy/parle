/**
 * Production-like Stage 3 compatibility gate on rehearsal Neon.
 * Does not enable PARLE_V2_WRITES, PARLE_V2_TEST_STUB, PARLE_V2_RECOVERY, or V2 surface.
 */
const http = require('http')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')

loadEnvLocal()

const PORT = Number(process.env.STAGE3_HTTP_PORT || 3077)
const ORIGIN = `http://127.0.0.1:${PORT}`

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

function cleanEnv(base) {
  const env = { ...base }
  delete env.PARLE_V2_WRITES
  delete env.PARLE_V2_TEST_STUB
  delete env.PARLE_V2_RECOVERY
  delete env.PARLE_V2_OPS_CONTROL
  delete env.PARLE_V2_SKIP_DAILY
  delete env.NEXT_PUBLIC_PARLE_V2_SURFACE
  env.NODE_ENV = 'production'
  env.PARLE_V2_WRITES = ''
  env.PARLE_V2_TEST_STUB = ''
  env.PARLE_V2_RECOVERY = ''
  env.NEXT_PUBLIC_PARLE_V2_SURFACE = ''
  return env
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL missing; run via scripts/run-with-rehearsal.js')
  }

  const env = cleanEnv(process.env)
  const build = spawnSync(
    process.execPath,
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
    {
      cwd: path.join(__dirname, '..'),
      env,
      encoding: 'utf8',
    },
  )
  process.stdout.write(build.stdout || '')
  process.stderr.write(build.stderr || '')
  if (build.status !== 0) {
    process.exit(build.status == null ? 1 : build.status)
  }

  const child = spawn(
    process.execPath,
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...env,
        PORT: String(PORT),
        APP_URL: ORIGIN,
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
    const seed = spawnSync(process.execPath, ['scripts/seed-test-users.js'], {
      cwd: path.join(__dirname, '..'),
      env,
      encoding: 'utf8',
    })
    process.stdout.write(seed.stdout || '')
    process.stderr.write(seed.stderr || '')
    if (seed.status !== 0) {
      process.exit(seed.status == null ? 1 : seed.status)
    }

    const result = spawnSync(
      process.execPath,
      ['--test', '--test-concurrency=1', 'tests/api/v2Stage3Compat.http.test.js'],
      {
        cwd: path.join(__dirname, '..'),
        env: {
          ...env,
          RUN_STAGE3_HTTP: '1',
          TEST_API_BASE: ORIGIN,
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

    const browser = spawnSync(
      process.execPath,
      [
        path.join('node_modules', '@playwright', 'test', 'cli.js'),
        'test',
        'tests/e2e/v2-stage3-compat.spec.js',
        '--project=chromium',
      ],
      {
        cwd: path.join(__dirname, '..'),
        env: {
          ...env,
          RUN_STAGE3_BROWSER: '1',
          PLAYWRIGHT_BASE_URL: ORIGIN,
        },
        encoding: 'utf8',
      },
    )
    process.stdout.write(browser.stdout || '')
    process.stderr.write(browser.stderr || '')
    if (browser.status !== 0) {
      process.stderr.write(nextLog.slice(-4000))
      process.exit(browser.status == null ? 1 : browser.status)
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
