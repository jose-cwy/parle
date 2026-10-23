const { issueChallenge, canResend, markChallengeSent, latestOpenChallenge } = require('./authChallenges')
const { sendVerificationEmail } = require('../../utils/resend')

async function sendOrRefreshVerification({ userId, email, purpose = 'signup' }) {
  const cooldown = await canResend(email, purpose)
  if (!cooldown.ok) {
    return { ok: true, throttled: true, retryAfterMs: cooldown.retryAfterMs, delivered: false }
  }

  const issued = await issueChallenge({ userId, email, purpose })
  const delivered = await sendVerificationEmail(issued.email, issued.raw)
  if (!delivered.ok) {
    return { ok: true, throttled: false, delivered: false, reason: delivered.reason }
  }
  return { ok: true, throttled: false, delivered: true }
}

async function resendVerification({ userId, email, purpose = 'existing_verify' }) {
  const cooldown = await canResend(email, purpose)
  if (!cooldown.ok) {
    return { ok: false, throttled: true, retryAfterMs: cooldown.retryAfterMs }
  }
  const open = await latestOpenChallenge(email, purpose)
  const issued = await issueChallenge({ userId, email, purpose })
  const delivered = await sendVerificationEmail(issued.email, issued.raw)
  if (open?.id) {
    await markChallengeSent(open.id)
  }
  if (!delivered.ok) {
    return { ok: false, throttled: false, delivered: false, reason: delivered.reason }
  }
  return { ok: true, throttled: false, delivered: true }
}

module.exports = {
  sendOrRefreshVerification,
  resendVerification,
}
