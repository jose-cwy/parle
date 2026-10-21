const db = require('../db')
const { isExcludedMetricsEmail } = require('./metricsExclude')

const ALLOWED_NAMES = new Set([
  'account_created',
  'conversation_started',
  'message_sent',
  'user_activated',
  'feedback_thumbs',
  'feedback_outcome',
  'survey_shown',
  'survey_skipped',
])

const ALLOWED_FIELDS = new Set([
  'name',
  'userId',
  'isGuest',
  'modeId',
  'sessionKey',
  'rating',
  'reason',
  'dimension',
  'response',
  'messageCount',
])

function clip(value, max) {
  if (value == null || value === '') return null
  return String(value).slice(0, max)
}

function sanitizeEvent(input = {}) {
  const name = clip(input.name, 64)
  if (!ALLOWED_NAMES.has(name)) return null
  const extra = Object.keys(input).filter((key) => !ALLOWED_FIELDS.has(key) && key !== 'name')
  if (extra.length) {
    /* drop unknown keys by reconstructing */
  }
  return {
    name,
    userId: input.userId || null,
    isGuest: Boolean(input.isGuest) && !input.userId,
    modeId: clip(input.modeId, 64),
    sessionKey: input.isGuest ? null : clip(input.sessionKey, 64),
    rating: clip(input.rating, 16),
    reason: clip(input.reason, 64),
    dimension: clip(input.dimension, 16),
    response: clip(input.response, 64),
    messageCount: Number.isFinite(Number(input.messageCount)) ? Number(input.messageCount) : null,
  }
}

async function recordProductEvent(input) {
  try {
    const event = sanitizeEvent(input)
    if (!event) return { ok: false, skipped: 'invalid' }
    await db.query(
      `INSERT INTO product_events
        (name, user_id, is_guest, mode_id, session_key, rating, reason, dimension, response, message_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        event.name,
        event.userId,
        event.isGuest,
        event.modeId,
        event.sessionKey,
        event.rating,
        event.reason,
        event.dimension,
        event.response,
        event.messageCount,
      ],
    )
    return { ok: true }
  } catch (error) {
    if (error?.code === '23505') return { ok: true, duplicate: true }
    if (error?.code === '42P01' || error?.code === '42703') return { ok: false, skipped: 'schema' }
    console.error('product_event_error', { name: input?.name || null, code: error?.code || 'unknown' })
    return { ok: false, skipped: 'error' }
  }
}

async function stampActivation(userId) {
  if (!userId) return { ok: false }
  try {
    await db.query(
      `UPDATE users
       SET first_activated_at = now()
       WHERE id = $1 AND first_activated_at IS NULL`,
      [userId],
    )
    await recordProductEvent({ name: 'user_activated', userId, isGuest: false })
    return { ok: true }
  } catch (error) {
    if (error?.code === '42703' || error?.code === '42P01') return { ok: false, skipped: 'schema' }
    console.error('activation_stamp_error', { code: error?.code || 'unknown' })
    return { ok: false }
  }
}

async function recordAuthedChatActivity({ userId, modeId, sessionKey, isNewSession }) {
  if (!userId) return
  await recordProductEvent({
    name: 'message_sent',
    userId,
    isGuest: false,
    modeId,
    sessionKey,
  })
  if (isNewSession) {
    await recordProductEvent({
      name: 'conversation_started',
      userId,
      isGuest: false,
      modeId,
      sessionKey,
    })
  }
  await stampActivation(userId)
}

function shouldRecordGuestMessageSent({ kind, locked, rejected } = {}) {
  if (rejected || locked) return false
  return kind === 'normal'
}

async function recordGuestChatActivity({ modeId }) {
  return recordProductEvent({
    name: 'message_sent',
    isGuest: true,
    modeId,
  })
}

async function hasSurveyBeenShownToday(userId) {
  if (!userId) return false
  try {
    const result = await db.query(
      `SELECT 1
       FROM product_events
       WHERE user_id = $1
         AND name = 'survey_shown'
         AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
       LIMIT 1`,
      [userId],
    )
    return Boolean(result.rows[0])
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703') return false
    return false
  }
}

module.exports = {
  ALLOWED_NAMES,
  ALLOWED_FIELDS,
  sanitizeEvent,
  recordProductEvent,
  stampActivation,
  recordAuthedChatActivity,
  recordGuestChatActivity,
  shouldRecordGuestMessageSent,
  hasSurveyBeenShownToday,
  isExcludedMetricsEmail,
}
