import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { insertProductFeedback } from '../../../lib/parle/feedbackDb'

const ALLOWED_VARIANTS = new Set(['A', 'B'])
const ALLOWED_RESPONSES = new Set([
  'helping',
  'a little',
  'not really',
  'yes',
  'maybe',
  'probably not',
])

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { tier: 'default' })
  if (guard.handled) return

  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const {
    session_id: sessionId,
    variant,
    response,
    note,
    message_count: messageCount,
    is_guest: isGuest,
  } = req.body || {}

  const safeVariant = String(variant || '').trim().toUpperCase()
  const safeResponse = String(response || '').trim().toLowerCase()
  const safeSessionId = String(sessionId || '').trim()

  if (!safeSessionId || !ALLOWED_VARIANTS.has(safeVariant) || !ALLOWED_RESPONSES.has(safeResponse)) {
    return res.status(400).json({ error: 'Invalid product feedback' })
  }

  try {
    await insertProductFeedback({
      userId: guard.payload?.id || null,
      sessionId: safeSessionId,
      variant: safeVariant,
      response: safeResponse,
      note,
      messageCount,
      isGuest: Boolean(isGuest) || !guard.payload?.id,
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    return handleApiError(res, error, 'product_feedback')
  }
}
