import { isValidOnboardingReason } from '../../../lib/parle/onboarding'
import { saveGuestEmailCapture } from '../../../lib/parle/guestEmailsDb'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { tier: 'guestEmail' })
  if (guard.handled) return

  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const { email, reason, message_count: messageCount } = req.body || {}
  const safeReason =
    reason && isValidOnboardingReason(reason) ? String(reason) : null

  try {
    const result = await saveGuestEmailCapture({
      email,
      reason: safeReason,
      sessionMessageCount:
        Number.isFinite(Number(messageCount)) ? Number(messageCount) : null,
    })

    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error || 'Invalid email' })
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    return handleApiError(res, error, 'guest_email')
  }
}
