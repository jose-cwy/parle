/**
 * Minimal Resend integration for sending verification/milestone emails.
 * Requires RESEND_API_KEY in env.
 *
 * Resend Node 1.1.0 does not throw on HTTP errors. `emails.send` resolves
 * `{ id }` on success and `{ name, message, statusCode }` on failure.
 */
let resendClient = null

const SEND_TIMEOUT_MS = 8000

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null
  if (!resendClient) {
    const { Resend } = require('resend')
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

function verificationFromAddress() {
  return process.env.PARLE_FROM_EMAIL || 'parlé <hello@parle.chat>'
}

function verificationPageUrl(token) {
  const base = String(process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/verify-email?token=${encodeURIComponent(token)}`
}

function interpretResendSendResult(result) {
  if (!result || typeof result !== 'object') {
    return { ok: false, reason: 'empty_result' }
  }
  if (result.error) {
    const nested = result.error
    return {
      ok: false,
      reason: 'delivery_failed',
      code: nested.statusCode || nested.name || 'error',
    }
  }
  const statusCode = Number(result.statusCode)
  if (Number.isFinite(statusCode) && statusCode >= 400) {
    return { ok: false, reason: 'delivery_failed', code: result.name || statusCode }
  }
  if (result.name && result.message && !result.id && !result.data?.id) {
    return { ok: false, reason: 'delivery_failed', code: result.name }
  }
  const id = result.id || result.data?.id
  if (id) return { ok: true, id: String(id) }
  return { ok: false, reason: 'unconfirmed' }
}

function withTimeout(promise, ms, reason = 'timeout') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(reason)
      error.code = 'SEND_TIMEOUT'
      reject(error)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function sendVerificationEmail(email, token) {
  const resend = getResendClient()
  if (!resend) {
    return { ok: false, reason: 'not_configured' }
  }
  if (!token) {
    return { ok: false, reason: 'missing_token' }
  }

  const url = verificationPageUrl(token)
  if (String(process.env.AUTH_TEST_MAIL || '') === '1') {
    const bucket = globalThis.__PARLE_TEST_MAILS || (globalThis.__PARLE_TEST_MAILS = [])
    bucket.push({ to: email, token, url, at: Date.now() })
    return { ok: true, test: true }
  }
  try {
    const result = await withTimeout(
      resend.emails.send({
        from: verificationFromAddress(),
        to: email,
        subject: 'Confirm your parlé email',
        text: `Confirm this email belongs to you by opening this link:\n${url}\n\nIf you did not create a parlé space, you can ignore this message.`,
        html: `<p>Confirm this email belongs to you.</p><p><a href="${url}">Confirm my email</a></p><p>If you did not create a parlé space, you can ignore this message.</p>`,
      }),
      SEND_TIMEOUT_MS,
    )
    const parsed = interpretResendSendResult(result)
    if (!parsed.ok) {
      console.warn('resend_verify_failed', { code: parsed.code || parsed.reason })
    }
    return parsed.ok ? { ok: true } : { ok: false, reason: parsed.reason }
  } catch (error) {
    console.warn('resend_verify_failed', { code: error?.code || error?.statusCode || error?.name || 'send' })
    return { ok: false, reason: error?.code === 'SEND_TIMEOUT' ? 'timeout' : 'delivery_failed' }
  }
}

async function sendGuestCheckInEmail(email) {
  const resend = getResendClient()
  if (!resend) return false

  const text = `hey.

it's been a couple of days since you came to parlé.

just wanted to check in — how are you doing?

if you want to keep talking, we're here.
parle.chat

— parlé`

  const result = await resend.emails.send({
    from: process.env.PARLE_FROM_EMAIL || 'parlé <hello@parle.chat>',
    to: email,
    subject: 'how are you doing?',
    text,
  })
  return interpretResendSendResult(result).ok
}

module.exports = {
  sendVerificationEmail,
  sendGuestCheckInEmail,
  verificationPageUrl,
  interpretResendSendResult,
  SEND_TIMEOUT_MS,
}
