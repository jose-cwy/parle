const { listDueGuestFollowups, markGuestFollowupSent } = require('./guestEmailsDb')
const { sendGuestCheckInEmail } = require('../../utils/resend')

async function processGuestEmailFollowups({ limit = 50 } = {}) {
  const due = await listDueGuestFollowups(limit)
  let sent = 0
  let skipped = 0

  for (const row of due) {
    try {
      const delivered = await sendGuestCheckInEmail(row.email)
      if (!delivered) {
        skipped += 1
        continue
      }
      await markGuestFollowupSent(row.id)
      sent += 1
    } catch (error) {
      console.warn('guest_email_followup_error', row.id, error?.message || error)
      skipped += 1
    }
  }

  return { sent, skipped, checked: due.length }
}

module.exports = { processGuestEmailFollowups }
