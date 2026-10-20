#!/usr/bin/env node
const crypto = require('crypto')
const { Client } = require('pg')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const db = require('../lib/db')
const { requireAdminUser } = require('../lib/parle/adminAuth')

loadEnvLocal()

const BASE = process.env.PHASE2_BASE_URL || 'http://localhost:3000'
const ORIGIN = process.env.PHASE2_ORIGIN || BASE
const EMAIL = 'testuser_a@parle.test'
const PASSWORD = 'TestPassword123!'
const CHILD = 'br-misty-recipe-apcj8oyo'

function cookieHeader(setCookie) {
  if (!setCookie) return ''
  const list = Array.isArray(setCookie) ? setCookie : [setCookie]
  return list.map((c) => String(c).split(';')[0]).join('; ')
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const cookie = cookieHeader(login.headers.getSetCookie?.() || login.headers.get('set-cookie'))
  if (!cookie) throw new Error('login failed')

  const sessionId = crypto.randomUUID()
  const headers = { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie }
  const shownBody = JSON.stringify({ action: 'shown', session_id: sessionId, mode_id: 'cross' })
  const concurrent = await Promise.all(
    [1, 2, 3].map(() =>
      fetch(`${BASE}/api/feedback/product`, { method: 'POST', headers, body: shownBody }),
    ),
  )
  const skip = await fetch(`${BASE}/api/feedback/product`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'skip', dimension: 'all', session_id: sessionId }),
  })
  const statusGet = await fetch(`${BASE}/api/feedback/product`, {
    headers: { Origin: ORIGIN, Cookie: cookie },
  })
  const adminApi = await fetch(`${BASE}/api/admin/insights`, {
    headers: { Origin: ORIGIN, Cookie: cookie },
  })
  const adminPage = await fetch(`${BASE}/admin/insights`, { headers: { Cookie: cookie } })
  const anonApi = await fetch(`${BASE}/api/admin/insights`, { headers: { Origin: ORIGIN } })

  const user = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [EMAIL])
  const userId = user.rows[0]?.id
  const asAdmin = await requireAdminUser({ id: userId }, { ADMIN_EMAILS: EMAIL })
  const asStranger = await requireAdminUser({ id: userId }, { ADMIN_EMAILS: 'nobody@parle.chat' })
  const missing = await requireAdminUser({}, { ADMIN_EMAILS: EMAIL })

  const child = new Client({
    connectionString: process.env.REHEARSAL_DATABASE_URL,
    ssl: { rejectUnauthorized: true },
  })
  await child.connect()
  let childCodes = []
  try {
    const ident = await child.query(`select current_setting('neon.branch_id', true) as branch_id`)
    if (ident.rows[0].branch_id !== CHILD) throw new Error('not child')
    const uidRow = await child.query(`SELECT id FROM users WHERE email = 'phase3-verify@parle.test'`)
    const uid = uidRow.rows[0].id
    const stamp = `concurrent-${Date.now()}`
    const settled = await Promise.allSettled([
      child.query(
        `INSERT INTO product_events (name, user_id, is_guest, session_key)
         VALUES ('survey_shown', $1, false, $2)`,
        [uid, `${stamp}-a`],
      ),
      child.query(
        `INSERT INTO product_events (name, user_id, is_guest, session_key)
         VALUES ('survey_shown', $1, false, $2)`,
        [uid, `${stamp}-b`],
      ),
    ])
    childCodes = settled.map((row) => (row.status === 'rejected' ? row.reason?.code : 'ok'))
  } finally {
    await child.end()
  }

  const askedToday = await statusGet.json()
  const out = {
    concurrentShown: concurrent.map((r) => r.status),
    skip: skip.status,
    askedTodayStatus: statusGet.status,
    askedToday,
    adminApiAuthed: adminApi.status,
    adminPageAuthed: adminPage.status,
    adminApiAnon: anonApi.status,
    requireAdminAllowlisted: asAdmin.ok === true,
    requireAdminStranger: asStranger.ok === false && asStranger.status === 404,
    requireAdminMissing: missing.ok === false,
    childConcurrentCodes: childCodes,
    childHadUniqueViolation: childCodes.includes('23505'),
  }
  console.log(JSON.stringify(out, null, 2))
  if (out.concurrentShown.some((status) => status !== 200)) throw new Error('concurrent shown failed')
  if (out.skip !== 200) throw new Error('skip failed')
  if (out.adminApiAuthed !== 404) throw new Error('authed non-admin API must 404')
  if (out.adminApiAnon !== 401 && out.adminApiAnon !== 404) {
    throw new Error('anonymous admin API must not succeed')
  }
  if (!out.requireAdminAllowlisted || !out.requireAdminStranger || !out.requireAdminMissing) {
    throw new Error('ADMIN_EMAILS gate failed')
  }
  if (!out.childHadUniqueViolation) throw new Error('expected 23505 on concurrent survey_shown')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
