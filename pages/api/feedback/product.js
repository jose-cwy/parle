import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { insertProductFeedback } from '../../../lib/parle/feedbackDb'
import {
  hasSurveyBeenShownToday,
  recordProductEvent,
} from '../../../lib/parle/productEvents'

const ALLOWED_ACTIONS = new Set(['status', 'shown', 'skip', 'answer'])
const ALLOWED_DIMENSIONS = new Set(['relief', 'clarity', 'all'])
const ALLOWED_RESPONSES = {
  relief: new Set(['better', 'same', 'worse']),
  clarity: new Set(['clearer', 'same', 'less_clear']),
}

export default async function handler(req, res) {
  const guard = await runApiPipeline(req, res, { tier: 'default' })
  if (guard.handled) return

  if (req.method === 'GET') {
    const askedToday = guard.payload?.id ? await hasSurveyBeenShownToday(guard.payload.id) : false
    return res.status(200).json({ askedToday })
  }

  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const {
    action,
    session_id: sessionId,
    dimension,
    response,
    message_count: messageCount,
    mode_id: modeId,
    is_guest: isGuest,
  } = req.body || {}

  const safeAction = String(action || 'answer').trim().toLowerCase()
  if (!ALLOWED_ACTIONS.has(safeAction)) {
    return res.status(400).json({ error: 'Invalid product feedback' })
  }

  const userId = guard.payload?.id || null
  const guest = Boolean(isGuest) || !userId
  const safeSession = String(sessionId || '').trim()
  const safeDimension = String(dimension || '').trim().toLowerCase()

  try {
    if (safeAction === 'status') {
      const askedToday = userId ? await hasSurveyBeenShownToday(userId) : false
      return res.status(200).json({ askedToday })
    }

    if (safeAction === 'shown') {
      if (userId) {
        const askedToday = await hasSurveyBeenShownToday(userId)
        if (askedToday) return res.status(200).json({ ok: true, askedToday: true })
      }
      await recordProductEvent({
        name: 'survey_shown',
        userId,
        isGuest: guest,
        sessionKey: userId ? safeSession : null,
        modeId,
      })
      return res.status(200).json({ ok: true })
    }

    if (safeAction === 'skip') {
      if (safeDimension && !ALLOWED_DIMENSIONS.has(safeDimension)) {
        return res.status(400).json({ error: 'Invalid product feedback' })
      }
      await recordProductEvent({
        name: 'survey_skipped',
        userId,
        isGuest: guest,
        sessionKey: userId ? safeSession : null,
        dimension: safeDimension || 'all',
        modeId,
      })
      return res.status(200).json({ ok: true })
    }

    if (!ALLOWED_DIMENSIONS.has(safeDimension) || safeDimension === 'all') {
      return res.status(400).json({ error: 'Invalid product feedback' })
    }
    const safeResponse = String(response || '').trim().toLowerCase()
    if (!ALLOWED_RESPONSES[safeDimension].has(safeResponse)) {
      return res.status(400).json({ error: 'Invalid product feedback' })
    }
    if (!safeSession) {
      return res.status(400).json({ error: 'Invalid product feedback' })
    }

    await insertProductFeedback({
      userId,
      sessionId: safeSession,
      variant: null,
      response: safeResponse,
      note: null,
      messageCount,
      isGuest: guest,
      dimension: safeDimension,
    })
    await recordProductEvent({
      name: 'feedback_outcome',
      userId,
      isGuest: guest,
      sessionKey: userId ? safeSession : null,
      dimension: safeDimension,
      response: safeResponse,
      modeId,
      messageCount,
    })
    return res.status(200).json({ ok: true })
  } catch (error) {
    return handleApiError(res, error, 'product_feedback')
  }
}
