import { processGuestEmailFollowups } from '../../../lib/parle/processGuestEmailFollowups'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).end()
  }

  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided =
      req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
      req.query?.secret ||
      req.body?.secret
    if (provided !== secret) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  try {
    const result = await processGuestEmailFollowups()
    return res.status(200).json(result)
  } catch (error) {
    console.error('guest_email_followups_cron_error', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
