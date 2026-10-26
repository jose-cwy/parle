import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { insertMessageFeedback } from '../../../lib/parle/feedbackDb'
import { recordProductEvent } from '../../../lib/parle/productEvents'

const ALLOWED_RATINGS = new Set(['up', 'down'])
const ALLOWED_REASONS = new Set([
  'didnt_understand',
  'too_much_advice',
  'too_many_questions',
  'made_assumptions',
  'too_repetitive',
  'other',
])

export default async function handler(req, res) {
  const guard = await runApiPipeline(req, res, { tier: 'default' })
  if (guard.handled) return

  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const {
    message_id: messageId,
    rating,
    reason,
    session_id: sessionId,
    mode_id: modeId,
    is_guest: isGuest,
  } = req.body || {}

  const safeRating = String(rating || '').trim().toLowerCase()
  if (!ALLOWED_RATINGS.has(safeRating)) {
    return res.status(400).json({ error: 'Invalid rating' })
  }

  let safeReason = null
  if (reason != null && String(reason).trim()) {
    safeReason = String(reason).trim().toLowerCase()
    if (!ALLOWED_REASONS.has(safeReason)) {
      return res.status(400).json({ error: 'Invalid reason' })
    }
  }

  try {
    await insertMessageFeedback({
      userId: guard.payload?.id || null,
      sessionId,
      messageId,
      rating: safeRating,
      reason: safeReason,
      modeId,
      isGuest: Boolean(isGuest) || !guard.payload?.id,
    })
    await recordProductEvent({
      name: 'feedback_thumbs',
      userId: guard.payload?.id || null,
      isGuest: Boolean(isGuest) || !guard.payload?.id,
      modeId,
      sessionKey: guard.payload?.id ? sessionId : null,
      rating: safeRating,
      reason: safeReason,
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    return handleApiError(res, error, 'message_feedback')
  }
}
