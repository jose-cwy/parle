import { processGuestEmailFollowups } from '../../../lib/parle/processGuestEmailFollowups'
import { authorizeCron } from '../../../lib/parle/cronAuth'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).end()
  }

  const auth = authorizeCron(req)
  if (!auth.ok) {
    return res.status(auth.status).json(auth.body)
  }

  try {
    const result = await processGuestEmailFollowups()
    return res.status(200).json(result)
  } catch (error) {
    console.error('guest_email_followups_cron_error', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
