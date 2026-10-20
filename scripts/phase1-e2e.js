#!/usr/bin/env node
/**
 * Phase 1 API verification against the local Next server (DATABASE_URL / primary).
 * Uses dedicated testuser_a@parle.test only.
 */
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const bcrypt = require('bcryptjs')

loadEnvLocal()

const BASE = process.env.PHASE1_BASE_URL || 'http://localhost:3000'
const EMAIL = 'testuser_a@parle.test'
const PASSWORD = 'TestPassword123!'
const ORIGIN = 'http://localhost:3000'

async function ensureTestUser() {
  const db = require('../lib/db')
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [EMAIL])
  const hash = await bcrypt.hash(PASSWORD, 10)
  if (existing.rows.length) {
    await db.query(
      `UPDATE users
       SET password = $1, memory_enabled = TRUE, personalisation_enabled = TRUE
       WHERE email = $2`,
      [hash, EMAIL],
    )
    return existing.rows[0].id
  }
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent)
     VALUES ($1, $2, $3, TRUE, TRUE, FALSE)
     RETURNING id`,
    [EMAIL, hash, 'testuser_a'],
  )
  return inserted.rows[0].id
}

function cookieHeader(setCookie) {
  if (!setCookie) return ''
  const list = Array.isArray(setCookie) ? setCookie : [setCookie]
  return list.map((c) => String(c).split(';')[0]).join('; ')
}

async function readSse(res) {
  const thinkMs = Number(res.headers.get('x-parle-think-ms'))
  const started = Date.now()
  let firstDeltaMs = null
  let ttfbMs = null
  let reply = ''
  const raw = await res.text()
  const wallMs = Date.now() - started
  for (const block of raw.split('\n\n')) {
    const line = block.trim()
    if (!line.startsWith('data:')) continue
    const payload = JSON.parse(line.slice(5).trim())
    if (payload.delta && firstDeltaMs == null) firstDeltaMs = 0
    if (payload.delta) reply += payload.delta
    if (payload.done) {
      ttfbMs = payload.ttfbMs
      if (payload.reply) reply = payload.reply
    }
  }
  return { thinkMs, ttfbMs, wallMs, reply, rawLen: raw.length }
}

async function main() {
  const results = []
  const userId = await ensureTestUser()
  console.log(JSON.stringify({ test_account: EMAIL, user_id_set: Boolean(userId) }))

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const loginBody = await loginRes.json().catch(() => ({}))
  const cookie = cookieHeader(loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie'))
  results.push({
    name: 'auth_login',
    ok: loginRes.status === 200 && Boolean(cookie) && loginBody.ok === true,
    status: loginRes.status,
  })
  if (!cookie) {
    console.log(JSON.stringify({ results, failed: 'no session cookie' }))
    process.exit(1)
  }

  const meRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Origin: ORIGIN, Cookie: cookie },
  })
  const me = await meRes.json().catch(() => ({}))
  results.push({
    name: 'auth_me',
    ok: meRes.status === 200 && me?.user?.email === EMAIL,
    status: meRes.status,
  })

  const sendStarted = Date.now()
  const sendRes = await fetch(`${BASE}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      text: 'this is a dedicated phase1 rehearsal check. i feel tired after a long day.',
      modeId: 'listen',
      messages: [],
    }),
  })
  const sendWaitMs = Date.now() - sendStarted
  const stream = await readSse(sendRes)
  const timeToFirstVisibleMs =
    Number.isFinite(stream.thinkMs) && Number.isFinite(stream.ttfbMs)
      ? stream.thinkMs + stream.ttfbMs
      : sendWaitMs
  results.push({
    name: 'chat_send_stream',
    ok: sendRes.status === 200 && Boolean(stream.reply && stream.reply.length > 8),
    status: sendRes.status,
    thinkMs: stream.thinkMs,
    ttfbMs: stream.ttfbMs,
    timeToFirstVisibleMs,
    sendWaitMs,
    replyChars: stream.reply.length,
  })

  const historyRes = await fetch(`${BASE}/api/chat/history`, {
    headers: { Origin: ORIGIN, Cookie: cookie },
  })
  const history = await historyRes.json().catch(() => [])
  const hasUser = Array.isArray(history) && history.some((m) => m.role === 'user' && /phase1 rehearsal/.test(m.text || ''))
  const hasAssistant = Array.isArray(history) && history.some((m) => m.role === 'assistant' && String(m.text || '').length > 8)
  results.push({
    name: 'chat_history_persistence',
    ok: historyRes.status === 200 && hasUser && hasAssistant,
    status: historyRes.status,
    rows: Array.isArray(history) ? history.length : 0,
  })

  const fbRes = await fetch(`${BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      rating: 'up',
      session_id: 'phase1-e2e',
      message_id: 'phase1-e2e',
      mode_id: 'listen',
      is_guest: false,
    }),
  })
  results.push({ name: 'feedback_up', ok: fbRes.status === 200, status: fbRes.status })

  const sessionId = require('crypto').randomUUID()
  const endRes = await fetch(`${BASE}/api/chat/session-end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      sessionId,
      message_count: 2,
      user_avg_message_length: 40,
      avg_reply_gap_seconds: 3,
      mode_switches: 0,
      starting_mode: 'listen',
      final_mode: 'listen',
      silence_after_response_count: 0,
      repeat_sentiment_detected: false,
      session_length_minutes: 1,
      transcript: 'this is a dedicated phase1 rehearsal check. i feel tired after a long day.',
    }),
  })
  const endBody = await endRes.json().catch(() => ({}))
  results.push({
    name: 'personalization_session_end',
    ok: endRes.status === 200 && endBody?.ok !== false,
    status: endRes.status,
  })

  const guest1 = await fetch(`${BASE}/api/chat/guest-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ text: 'guest phase1 check: feeling a bit lost tonight.', modeId: 'listen', messages: [] }),
  })
  const guestStream = await readSse(guest1)
  const remaining = Number(guest1.headers.get('x-parle-usage-remaining'))
  const limit = Number(guest1.headers.get('x-parle-usage-limit'))
  results.push({
    name: 'guest_send_and_limit_headers',
    ok: guest1.status === 200 && Number.isFinite(limit) && limit === 30 && Number.isFinite(remaining) && remaining < limit,
    status: guest1.status,
    remaining,
    limit,
    thinkMs: guestStream.thinkMs,
    ttfbMs: guestStream.ttfbMs,
  })

  const failed = results.filter((r) => !r.ok)
  console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, failed: failed.length, results }, null, 2))
  process.exit(failed.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
