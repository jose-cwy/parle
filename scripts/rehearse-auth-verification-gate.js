#!/usr/bin/env node
/**
 * Isolated auth-verification security gate.
 * Uses REHEARSAL_DATABASE_URL only. Never touches the primary.
 * AUTH_TEST_MAIL=1 so Resend is not called.
 */
const http = require('http')
const { spawn, spawnSync } = require('child_process')
const path = require('path')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Client } = require('pg')
const {
  loadEnvLocal,
  resolveRehearsalUrl,
  publicHost,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')

const PORT = Number(process.env.GATE_PORT || 3025)
const ORIGIN = `http://127.0.0.1:${PORT}`
const PASSWORD = 'GatePass123!'
const stamp = Date.now()

loadEnvLocal()
const rehearsalUrl = resolveRehearsalUrl()

const results = []
function pass(name) {
  results.push({ name, ok: true })
  console.log('PASS', name)
}
function fail(name, error) {
  results.push({ name, ok: false, error: String(error.message || error).slice(0, 240) })
  console.log('FAIL', name, String(error.message || error).slice(0, 240))
}
async function assert(name, fn) {
  try {
    await fn()
    pass(name)
  } catch (error) {
    fail(name, error)
  }
}

function request(pathname, { method = 'GET', headers = {}, body, cookies = '', ip = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: pathname,
        method,
        headers: {
          Origin: ORIGIN,
          'x-forwarded-for': ip,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(cookies ? { Cookie: cookies } : {}),
          ...headers,
        },
      },
      (res) => {
        const setCookie = [].concat(res.headers['set-cookie'] || [])
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          let json = null
          try { json = JSON.parse(data) } catch { /* text */ }
          resolve({ status: res.statusCode, setCookie, body: data, json })
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(20000, () => req.destroy(new Error('timeout')))
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

function cookieHeader(setCookie, extra = '') {
  const parts = setCookie.map((c) => String(c).split(';')[0]).filter(Boolean)
  if (extra) parts.push(extra)
  return parts.join('; ')
}

function hasSession(setCookie) {
  return setCookie.some((c) => /^hs_session=/.test(String(c).split(';')[0]) && !/hs_session=;/.test(c))
}

async function waitForServer(child) {
  const started = Date.now()
  while (Date.now() - started < 90000) {
    if (child.exitCode != null) throw new Error(`next exited ${child.exitCode}`)
    try {
      const res = await request('/api/health')
      if (res.status && res.status < 500) return
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('next did not become ready')
}

async function confirmIdentity(client) {
  const ident = await client.query(`
    select current_database() as db,
           current_setting('neon.project_id', true) as project_id,
           current_setting('neon.branch_id', true) as branch_id
  `)
  const row = ident.rows[0]
  console.log(JSON.stringify({
    host: publicHost(rehearsalUrl),
    db: row.db,
    project_id: row.project_id,
    branch_id: row.branch_id,
  }))
  if (row.project_id !== EXPECTED_PROJECT_ID) throw new Error('unexpected project')
  if (row.branch_id === PRIMARY_BRANCH_ID) throw new Error('refusing primary')
}

async function latestMail(email) {
  const res = await request(`/api/auth/verify-email/test-mailbox?email=${encodeURIComponent(email)}`)
  if (res.status !== 200) throw new Error(`mailbox ${res.status}`)
  const mails = res.json?.mails || []
  return mails[mails.length - 1] || null
}

async function main() {
  const client = new Client({ connectionString: rehearsalUrl, ssl: { rejectUnauthorized: true } })
  await client.connect()
  await confirmIdentity(client)

  const hash = await bcrypt.hash(PASSWORD, 4)
  const newEmail = `gate-new-${stamp}@parle.test`
  const leftoverEmail = `gate-left-${stamp}@parle.test`
  const legacyEmail = `gate-legacy-${stamp}@parle.test`
  const verifiedEmail = `gate-verified-${stamp}@parle.test`
  const takenEmail = `gate-taken-${stamp}@parle.test`
  const changeEmail = `gate-change-${stamp}@parle.test`
  const changeTo = `gate-newbox-${stamp}@parle.test`
  const changeTo2 = `gate-newbox2-${stamp}@parle.test`
  const founderProbe = `gate-nonadmin-${stamp}@parle.test`

  const leftover = await client.query(
    `INSERT INTO users (email, password, preferred_name, email_verification_required, created_at, updated_at)
     VALUES ($1,$2,'Leftover', TRUE, now(), now()) RETURNING id`,
    [leftoverEmail, hash],
  )
  const leftoverId = leftover.rows[0].id
  await client.query(
    `INSERT INTO users (email, password, preferred_name, email_verification_required, created_at, updated_at)
     VALUES ($1,$2,'Legacy', TRUE, '2026-10-20T02:00:00.000Z', now())`,
    [legacyEmail, hash],
  )
  await client.query(
    `INSERT INTO users (email, password, preferred_name, email_verification_required, email_verified_at, created_at, updated_at)
     VALUES ($1,$2,'Verified', TRUE, now(), now(), now())`,
    [verifiedEmail, hash],
  )
  await client.query(
    `INSERT INTO users (email, password, preferred_name, email_verification_required, email_verified_at, created_at, updated_at)
     VALUES ($1,$2,'Taken', TRUE, now(), now(), now())`,
    [takenEmail, hash],
  )
  const changer = await client.query(
    `INSERT INTO users (email, password, preferred_name, email_verification_required, created_at, updated_at)
     VALUES ($1,$2,'Changer', TRUE, '2026-10-20T03:00:00.000Z', now()) RETURNING id`,
    [changeEmail, hash],
  )
  const changerId = changer.rows[0].id
  await client.query(
    `INSERT INTO users (email, password, preferred_name, email_verification_required, created_at, updated_at)
     VALUES ($1,$2,'Probe', TRUE, '2026-10-20T04:00:00.000Z', now())`,
    [founderProbe, hash],
  )
  await client.end()

  const child = spawn(
    process.execPath,
    [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        DATABASE_URL: rehearsalUrl,
        AUTH_TEST_MAIL: '1',
        AUTH_TEST_GOOGLE: '',
        NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN: 'false',
        PARLE_AUTH_GRACE_UNTIL: '',
        PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL: '',
        APP_URL: ORIGIN,
        PORT: String(PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let nextLog = ''
  child.stdout.on('data', (chunk) => { nextLog += String(chunk) })
  child.stderr.on('data', (chunk) => { nextLog += String(chunk) })

  const leftoverCookie = `hs_session=${jwt.sign({ id: leftoverId, email: leftoverEmail }, process.env.JWT_SECRET, { expiresIn: '1h' })}`

  try {
    try {
      await waitForServer(child)
    } catch (error) {
      console.error(nextLog.slice(-4000))
      throw error
    }

    await assert('test_mailbox_requires_auth_test_mail_on_this_server', async () => {
      const res = await request('/api/auth/verify-email/test-mailbox?email=x@parle.test')
      if (res.status !== 200) throw new Error(`expected 200 on rehearsal AUTH_TEST_MAIL, got ${res.status}`)
    })

    await assert('register_does_not_set_session', async () => {
      const terms = await request('/api/auth/terms-accept', { method: 'POST', body: {}, ip: '203.0.113.10' })
      const cookies = cookieHeader(terms.setCookie)
      const res = await request('/api/auth/register', {
        method: 'POST',
        cookies,
        ip: '203.0.113.10',
        body: {
          email: newEmail,
          password: PASSWORD,
          created_at: '2020-01-01T00:00:00.000Z',
          email_verification_required: false,
        },
      })
      if (res.status !== 201 || !res.json?.pending) throw new Error(`register ${res.status} ${res.body}`)
      if (hasSession(res.setCookie)) throw new Error('register set hs_session')
    })

    await assert('new_unverified_password_login_has_no_session', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        ip: '203.0.113.10',
        body: { email: newEmail, password: PASSWORD },
      })
      if (res.status !== 403 || !res.json?.pending) throw new Error(`login ${res.status} ${res.body}`)
      if (res.json.lockout) throw new Error('new account flagged as legacy lockout')
      if (hasSession(res.setCookie)) throw new Error('login set hs_session')
    })

    await assert('leftover_session_cannot_hit_protected_apis', async () => {
      const paths = [
        '/api/journal',
        '/api/quotes',
        '/api/user/settings',
        '/api/memory',
        '/api/chat/history',
        '/api/quotes/favorites',
      ]
      for (const pathname of paths) {
        const res = await request(pathname, { cookies: leftoverCookie })
        if (res.status !== 403 || res.json?.error !== 'pending_verification') {
          throw new Error(`${pathname} ${res.status} ${res.body}`)
        }
      }
    })

    await assert('legacy_unverified_can_login_while_grace_on', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        ip: '203.0.113.11',
        body: { email: legacyEmail, password: PASSWORD },
      })
      if (res.status !== 200) throw new Error(`legacy login ${res.status} ${res.body}`)
      if (!hasSession(res.setCookie)) throw new Error('legacy login missing session')
      const me = await request('/api/auth/me', { cookies: cookieHeader(res.setCookie) })
      if (!me.json?.user?.legacyUnverified) throw new Error('expected legacyUnverified')
      if (me.json.user.mustVerify) throw new Error('legacy mustVerify while grace on')
      const journal = await request('/api/journal', { cookies: cookieHeader(res.setCookie) })
      if (journal.status === 403 && journal.json?.error === 'pending_verification') {
        throw new Error('legacy blocked from journal')
      }
    })

    await assert('verified_account_full_access', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        ip: '203.0.113.12',
        body: { email: verifiedEmail, password: PASSWORD },
      })
      if (res.status !== 200) throw new Error(`verified login ${res.status}`)
      const cookies = cookieHeader(res.setCookie)
      const me = await request('/api/auth/me', { cookies })
      if (!me.json?.user?.emailVerified) throw new Error('expected verified')
      const journal = await request('/api/journal', { cookies })
      if (journal.status === 401 || journal.status === 403) throw new Error(`journal ${journal.status}`)
    })

    await assert('admin_enforcement_off_non_admin_is_404', async () => {
      const res = await request('/api/auth/login', {
        method: 'POST',
        ip: '203.0.113.13',
        body: { email: founderProbe, password: PASSWORD },
      })
      const cookies = cookieHeader(res.setCookie)
      const me = await request('/api/auth/me', { cookies })
      if (me.json?.user?.isAdmin) throw new Error('synthetic user must not be admin')
      const admin = await request('/api/admin/overview', { cookies })
      if (admin.status !== 404) throw new Error(`admin ${admin.status}`)
    })

    await assert('guest_chat_available', async () => {
      const res = await request('/api/chat/guest-usage')
      if (res.status !== 200) throw new Error(`guest-usage ${res.status}`)
    })

    await assert('email_change_requires_password_taken_and_no_move_until_confirm', async () => {
      const login = await request('/api/auth/login', {
        method: 'POST',
        ip: '203.0.113.15',
        body: { email: changeEmail, password: PASSWORD },
      })
      const cookies = cookieHeader(login.setCookie)
      const bad = await request('/api/auth/verify-email/change', {
        method: 'POST',
        cookies,
        ip: '203.0.113.15',
        body: { email: changeTo, password: 'wrong-password' },
      })
      if (bad.status !== 401) throw new Error(`wrong password ${bad.status}`)
      const taken = await request('/api/auth/verify-email/change', {
        method: 'POST',
        cookies,
        ip: '203.0.113.15',
        body: { email: takenEmail, password: PASSWORD },
      })
      if (taken.status !== 409) throw new Error(`taken ${taken.status}`)
      const firstReq = await request('/api/auth/verify-email/change', {
        method: 'POST',
        cookies,
        ip: '203.0.113.15',
        body: { email: changeTo, password: PASSWORD },
      })
      if (firstReq.status !== 200) throw new Error(`change ${firstReq.status} ${firstReq.body}`)
      const secondReq = await request('/api/auth/verify-email/change', {
        method: 'POST',
        cookies,
        ip: '203.0.113.15',
        body: { email: changeTo2, password: PASSWORD },
      })
      if (secondReq.status !== 200) throw new Error(`second change ${secondReq.status} ${secondReq.body}`)
      const me = await request('/api/auth/me', { cookies, ip: '203.0.113.15' })
      if (String(me.json?.user?.email).toLowerCase() !== changeEmail) {
        throw new Error('login email moved before confirm')
      }
      const mailA = await latestMail(changeTo)
      const mailB = await latestMail(changeTo2)
      if (!mailA?.token || !mailB?.token) throw new Error('missing concurrent tokens')
      const confirmA = await request('/api/auth/verify-email', {
        method: 'POST',
        ip: '203.0.113.15',
        body: { token: mailA.token },
      })
      if (confirmA.status !== 200) throw new Error(`confirm A ${confirmA.status} ${confirmA.body}`)
      const stale = await request('/api/auth/verify-email', {
        method: 'POST',
        ip: '203.0.113.15',
        body: { token: mailB.token },
      })
      if (![400, 409].includes(stale.status)) throw new Error(`stale B ${stale.status} ${stale.body}`)
      const reused = await request('/api/auth/verify-email', {
        method: 'POST',
        ip: '203.0.113.15',
        body: { token: mailA.token },
      })
      if (reused.status !== 400) throw new Error(`reused ${reused.status}`)
      const invalid = await request('/api/auth/verify-email', {
        method: 'POST',
        ip: '203.0.113.15',
        body: { token: 'not-a-real-token' },
      })
      if (invalid.status !== 400) throw new Error(`invalid ${invalid.status}`)
      const post = await request('/api/auth/login', {
        method: 'POST',
        ip: '203.0.113.16',
        body: { email: changeTo, password: PASSWORD },
      })
      if (post.status !== 200) throw new Error(`post-change login ${post.status}`)
      const me2 = await request('/api/auth/me', { cookies: cookieHeader(post.setCookie), ip: '203.0.113.16' })
      if (String(me2.json?.user?.email).toLowerCase() !== changeTo) throw new Error('me email not updated')
    })

    await assert('rate_limit_on_email_change', async () => {
      const login = await request('/api/auth/login', {
        method: 'POST',
        ip: '203.0.113.17',
        body: { email: verifiedEmail, password: PASSWORD },
      })
      const cookies = cookieHeader(login.setCookie)
      let saw429 = false
      for (let i = 0; i < 12; i += 1) {
        const res = await request('/api/auth/verify-email/change', {
          method: 'POST',
          cookies,
          ip: '203.0.113.17',
          body: { email: `rate-${i}-${stamp}@parle.test`, password: PASSWORD },
        })
        if (res.status === 429) {
          saw429 = true
          break
        }
      }
      if (!saw429) throw new Error('expected 429 on authStrict email-change')
    })

    await assert('new_account_client_cutoff_fields_did_not_grandfather', async () => {
      const login = await request('/api/auth/login', {
        method: 'POST',
        ip: '203.0.113.10',
        body: { email: newEmail, password: PASSWORD },
      })
      if (login.status !== 403) throw new Error(`still ${login.status}`)
    })

    const failedBeforePw = results.filter((row) => !row.ok)
    if (failedBeforePw.length) {
      console.error('next_log_tail', nextLog.slice(-6000))
    }

    const pwEnv = {
      ...process.env,
      DATABASE_URL: rehearsalUrl,
      AUTH_TEST_MAIL: '1',
      NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN: 'false',
      PLAYWRIGHT_BASE_URL: ORIGIN,
      GATE_LEGACY_EMAIL: legacyEmail,
      GATE_LEGACY_PASSWORD: PASSWORD,
    }
    const pw = spawnSync(
      process.execPath,
      [
        path.join('node_modules', '@playwright', 'test', 'cli.js'),
        'test',
        'tests/e2e/auth-verification-gate.spec.js',
        'tests/e2e/auth-release-gate.spec.js',
        '--reporter=line',
      ],
      {
        cwd: path.join(__dirname, '..'),
        env: pwEnv,
        encoding: 'utf8',
        timeout: 180000,
      },
    )
    process.stdout.write(pw.stdout || '')
    process.stderr.write(pw.stderr || '')
    if (pw.status !== 0) {
      fail('playwright_verification_gate', new Error(`exit ${pw.status}`))
    } else {
      pass('playwright_verification_gate')
    }
  } finally {
    if (child.pid) {
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
        } else {
          child.kill('SIGTERM')
        }
      } catch { /* already gone */ }
    }
  }

  const failed = results.filter((row) => !row.ok)
  console.log(JSON.stringify({
    passed: results.filter((row) => row.ok).length,
    failed: failed.length,
    total: results.length,
    failures: failed,
  }))
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
