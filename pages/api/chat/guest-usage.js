import { getClientIp } from '../../../lib/security/rateLimit'
import { getDailyUsage } from '../../../lib/usageTracking'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const guard = runApiPipeline(req, res, { tier: 'chatRead' })
  if (guard.handled) return

  try {
    const usage = await getDailyUsage({
      ip: getClientIp(req),
      isGuest: true,
    })

    return res.status(200).json({
      remaining: usage.remaining,
      limit: usage.limit,
      used: usage.used,
    })
  } catch (error) {
    return handleApiError(res, error, 'chat_guest_usage')
  }
}
