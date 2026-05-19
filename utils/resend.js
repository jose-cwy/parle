/**
 * Minimal Resend integration for sending verification/milestone emails.
 * Requires RESEND_API_KEY in env.
 */
const { Resend } = require('resend')
const resend = new Resend(process.env.RESEND_API_KEY || '')

async function sendVerificationEmail(email){
  if(!process.env.RESEND_API_KEY) return
  const content = `Welcome to Heartstrings Club — verify your email by visiting ${process.env.APP_URL || 'http://localhost:3000'}`
  await resend.emails.send({
    from: 'no-reply@heartstrings.club',
    to: email,
    subject: 'Verify your email — Heartstrings Club',
    html: `<p>${content}</p>`
  })
}

module.exports = { sendVerificationEmail }
