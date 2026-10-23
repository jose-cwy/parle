/**
 * Minimal Resend integration for sending verification/milestone emails.
 * Requires RESEND_API_KEY in env.
 */
let resendClient = null

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
    await resend.emails.send({
      from: verificationFromAddress(),
      to: email,
      subject: 'Confirm your parlé email',
      text: `Confirm this email belongs to you by opening this link:\n${url}\n\nIf you did not create a parlé space, you can ignore this message.`,
      html: `<p>Confirm this email belongs to you.</p><p><a href="${url}">Confirm my email</a></p><p>If you did not create a parlé space, you can ignore this message.</p>`,
    })
    return { ok: true }
  } catch (error) {
    console.warn('resend_verify_failed', { code: error?.statusCode || error?.name || 'send' })
    return { ok: false, reason: 'delivery_failed' }
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

  await resend.emails.send({
    from: process.env.PARLE_FROM_EMAIL || 'parlé <hello@parle.chat>',
    to: email,
    subject: 'how are you doing?',
    text,
  })
  return true
}

module.exports = { sendVerificationEmail, sendGuestCheckInEmail, verificationPageUrl }
