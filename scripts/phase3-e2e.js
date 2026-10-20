#!/usr/bin/env node
const crypto = require('crypto')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { isSurveyConversationEnding } = require('../lib/parle/surveyEnding')

loadEnvLocal()

const BASE = process.env.PHASE2_BASE_URL || 'http://localhost:3000'
const ORIGIN = process.env.PHASE2_ORIGIN || BASE
const EMAIL = 'testuser_a@parle.test'
const PASSWORD = 'TestPassword123!'
const MODES = ['cross', 'emotional', 'logical', 'vent', 'stop_contact', 'talk']

function cookieHeader(setCookie) {
  if (!setCookie) return ''
  const list = Array.isArray(setCookie) ? setCookie : [setCookie]
  return list.map((c) => String(c).split(';')[0]).join('; ')
}

async function send(cookie, body) {
  const res = await fetch(`${BASE}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  const ctype = String(res.headers.get('content-type') || '')
  if (ctype.includes('application/json') || raw.trim().startsWith('{')) {
    const json = JSON.parse(raw)
    return { status: res.status, reply: json.reply || '', safety: Boolean(json.safety) }
  }
  let reply = ''
  for (const block of raw.split('\n\n')) {
    const line = block.trim()
    if (!line.startsWith('data:')) continue
    try {
      const payload = JSON.parse(line.slice(5).trim())
      if (payload.delta) reply += payload.delta
      if (payload.done && payload.reply) reply = payload.reply
    } catch {
      /* ignore */
    }
  }
  return { status: res.status, reply, safety: false }
}

async function main() {
  const rows = []
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const cookie = cookieHeader(loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie'))
  rows.push({ name: 'auth', ok: loginRes.status === 200 && Boolean(cookie) })
  if (!cookie) {
    console.log(JSON.stringify({ failed: ['auth'], rows }, null, 2))
    process.exit(1)
  }

  const sessionId = crypto.randomUUID()
  for (const modeId of MODES) {
    const result = await send(cookie, {
      modeId,
      text: `synthetic phase3 ${modeId}: i miss them after a fight and needed to say that.`,
      messages: [],
      isNewSession: modeId === 'cross',
      sessionId,
    })
    rows.push({ name: `mode_${modeId}`, ok: result.status === 200 && result.reply.length > 4, status: result.status })
  }

  const followUp = await send(cookie, {
    modeId: 'talk',
    text: 'still thinking about that same fight from a minute ago.',
    messages: [
      { role: 'user', text: 'synthetic phase3 talk: i miss them after a fight and needed to say that.' },
      { role: 'assistant', text: 'i hear you.' },
    ],
    isNewSession: false,
    sessionId,
  })
  rows.push({
    name: 'session_follow_up',
    ok: followUp.status === 200 && followUp.reply.length > 4,
    status: followUp.status,
  })

  const thumbs = await fetch(`${BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      message_id: 'm1',
      rating: 'down',
      reason: 'too_much_advice',
      mode_id: 'cross',
      session_id: sessionId,
    }),
  })
  rows.push({ name: 'thumbs_reason', ok: thumbs.status === 200 })

  const oldReason = await fetch(`${BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({ rating: 'down', reason: 'felt too generic', message_id: 'm2' }),
  })
  rows.push({ name: 'thumbs_reject_legacy_reason', ok: oldReason.status === 400 })

  const shown = await fetch(`${BASE}/api/feedback/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({ action: 'shown', session_id: sessionId, mode_id: 'cross' }),
  })
  const skip = await fetch(`${BASE}/api/feedback/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({ action: 'skip', dimension: 'all', session_id: sessionId }),
  })
  rows.push({ name: 'survey_shown_skip', ok: shown.status === 200 && skip.status === 200 })

  const answer = await fetch(`${BASE}/api/feedback/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      action: 'answer',
      dimension: 'relief',
      response: 'better',
      session_id: sessionId,
    }),
  })
  rows.push({ name: 'survey_answer_relief', ok: answer.status === 200 })

  const invalid = await fetch(`${BASE}/api/feedback/product`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({ action: 'answer', dimension: 'relief', response: 'helping', session_id: sessionId }),
  })
  rows.push({ name: 'survey_reject_legacy_response', ok: invalid.status === 400 })

  const safety = await send(cookie, {
    modeId: 'cross',
    text: 'i want to die. i do not want to be here anymore.',
    sessionId,
  })
  rows.push({ name: 'safety', ok: safety.status === 200 && safety.safety === true })

  const admin = await fetch(`${BASE}/api/admin/insights`, { headers: { Origin: ORIGIN, Cookie: cookie } })
  rows.push({ name: 'admin_404_for_test_user', ok: admin.status === 404 })

  const guest = await fetch(`${BASE}/api/chat/guest-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      modeId: 'cross',
      text: 'guest phase3: i miss them after a fight.',
      sessionToken: `phase3-${Date.now()}`,
      messages: [],
    }),
  })
  rows.push({ name: 'guest_send', ok: guest.status === 200 })

  rows.push({
    name: 'ending_detector',
    ok:
      isSurveyConversationEnding("that's all i needed to say. i think i'm good for now.") &&
      !isSurveyConversationEnding("don't fix it"),
  })

  const failed = rows.filter((r) => !r.ok).map((r) => r.name)
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), failed, rows }, null, 2))
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
