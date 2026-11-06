/**
 * Authenticated V2 send against rehearsal + live OpenAI.
 * Does not enable PARLE_V2_TEST_STUB. Does not print secrets or transcripts.
 */
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { signToken } = require('../lib/auth')

loadEnvLocal()

const PORT = Number(process.env.V2_HTTP_PORT || 3061)
const ORIGIN = `http://127.0.0.1:${PORT}`
const REHEARSAL_BRANCH = 'br-square-unit-apbswjj3'

function request(pathname, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: pathname,
        method,
        headers: {
          Origin: ORIGIN,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
      },
    )
    req.on('error', reject)
    req.setTimeout(90_000, () => req.destroy(new Error('timeout')))
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

function parseSse(body) {
  return String(body || '')
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6))
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

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
      setTimeout(tick, 400)
    }
    tick()
  })
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing; use run-with-rehearsal.js')
  if (process.env.PARLE_V2_TEST_STUB === '1') {
    throw new Error('PARLE_V2_TEST_STUB must not be enabled for real-provider verification')
  }
  if (!process.env.OPENAI_API_KEY) {
    process.stdout.write('REAL_PROVIDER=NOT_VERIFIED reason=missing_openai_key\n')
    process.exit(2)
  }

  const db = require('../lib/db')
  const ident = await db.query(`SELECT current_setting('neon.branch_id', true) AS branch_id`)
  if (ident.rows[0]?.branch_id !== REHEARSAL_BRANCH) {
    throw new Error(`refusing branch ${ident.rows[0]?.branch_id}`)
  }

  const email = `v2c-real-${Date.now()}@parle.test`
  const password = await bcrypt.hash('v2c-real-pass', 4)
  const user = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, 'v2c-real', FALSE, FALSE, FALSE, now())
     RETURNING id, email`,
    [email, password],
  )
  const userId = user.rows[0].id
  const cookie = `hs_session=${signToken({ id: userId, email })}`
  const beforeMemory = await db.query(
    `SELECT COUNT(*)::bigint AS n, COALESCE(MAX(id), 0)::bigint AS max_id FROM chat_memory`,
  )

  const child = spawn(
    process.execPath,
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        APP_URL: ORIGIN,
        PARLE_V2_TEST_STUB: '',
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

  const result = {
    branch: ident.rows[0].branch_id,
    stub: process.env.PARLE_V2_TEST_STUB || '',
    firstToken: false,
    completed: false,
    persisted: false,
    consecutive: false,
    crisisJson: false,
    noCannedFallback: false,
    chatMemoryUnchanged: false,
  }

  try {
    await waitForServer(child)
    const created = await request('/api/conversations', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: { modeId: 'cross' },
    })
    if (created.status !== 201) throw new Error(`create ${created.status}`)
    const conversationId = JSON.parse(created.body).conversation.id

    const send1 = await request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: {
        text: 'This is a short synthetic check-in about feeling tired after a long week.',
        idempotencyKey: `real-1-${Date.now()}`,
        modeId: 'cross',
      },
    })
    const events = parseSse(send1.body)
    const canned = /what's sitting heaviest right now/i.test(send1.body)
    result.firstToken = events.some((event) => event.delta)
    result.completed = events.some((event) => event.done === true && String(event.reply || '').trim())
    result.noCannedFallback = !canned && !events.some((event) => /what's sitting heaviest/i.test(JSON.stringify(event)))

    const loaded = await request(`/api/conversations/${conversationId}`, { headers: { Cookie: cookie } })
    const thread = JSON.parse(loaded.body)
    result.persisted = (thread.messages || []).some((row) => row.role === 'assistant' && String(row.text || '').trim())

    const send2 = await request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: {
        text: 'And I keep replaying one conversation from yesterday.',
        idempotencyKey: `real-2-${Date.now()}`,
        modeId: 'cross',
      },
    })
    const after = JSON.parse(
      (await request(`/api/conversations/${conversationId}`, { headers: { Cookie: cookie } })).body,
    )
    const userTurns = (after.messages || []).filter((row) => row.role === 'user').length
    result.consecutive = send2.status === 200 && userTurns >= 2

    const crisis = await request(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: {
        text: 'i just want to disappear',
        idempotencyKey: `real-crisis-${Date.now()}`,
        modeId: 'cross',
      },
    })
    const crisisJson = (() => {
      try {
        return JSON.parse(crisis.body)
      } catch {
        return null
      }
    })()
    result.crisisJson = Boolean(crisisJson?.safety)

    const afterMemory = await db.query(
      `SELECT COUNT(*)::bigint AS n, COALESCE(MAX(id), 0)::bigint AS max_id FROM chat_memory`,
    )
    result.chatMemoryUnchanged =
      String(afterMemory.rows[0].n) === String(beforeMemory.rows[0].n)
      && String(afterMemory.rows[0].max_id) === String(beforeMemory.rows[0].max_id)

    const passed =
      result.firstToken
      && result.completed
      && result.persisted
      && result.consecutive
      && result.crisisJson
      && result.noCannedFallback
      && result.chatMemoryUnchanged

    process.stdout.write(`REAL_PROVIDER=${passed ? 'VERIFIED' : 'NOT_VERIFIED'} ${JSON.stringify(result)}\n`)
    if (!passed) {
      process.stderr.write(nextLog.slice(-2000))
      process.exit(1)
    }
  } finally {
    await db.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {})
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
}

main().catch((error) => {
  console.error(String(error.message || error).slice(0, 400))
  process.stdout.write('REAL_PROVIDER=NOT_VERIFIED\n')
  process.exit(1)
})
