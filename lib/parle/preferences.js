const db = require('../db')
const { getModeLabel } = require('./modes')

const DEFAULT_PROFILE = {
  preferred_response_length: 'medium',
  preferred_tone: 'balanced',
  responds_well_to_questions: true,
  prefers_validation_over_advice: true,
  average_message_length: 0,
  average_reply_speed_seconds: 0,
  mode_switch_count: 0,
  most_used_mode: 'Emotional support',
  session_count: 0,
  average_session_length_messages: 0,
  repeat_sentiment_count: 0,
}

const WARM_MODES = new Set([
  'Emotional support',
  'I just need to vent',
  'Comfort me first',
  'Just listen',
])
const DIRECT_MODES = new Set([
  'Be honest with me',
  'Help me understand what happened',
])
const VALIDATION_MODES = new Set([
  'Emotional support',
  'I just need to vent',
  'Just listen',
])

async function getOrCreateProfile(userId) {
  const existing = await db.query(
    'SELECT * FROM user_preference_profile WHERE user_id = $1',
    [userId],
  )
  if (existing.rows.length) return existing.rows[0]

  await db.query(
    `INSERT INTO user_preference_profile (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  )
  const created = await db.query(
    'SELECT * FROM user_preference_profile WHERE user_id = $1',
    [userId],
  )
  return created.rows[0] || { user_id: userId, ...DEFAULT_PROFILE }
}

async function getUserChatSettings(userId) {
  try {
    const user = await db.query(
      'SELECT memory_enabled, last_session_summary FROM users WHERE id = $1',
      [userId],
    )
    const profile = await getOrCreateProfile(userId)
    return {
      memory_enabled: Boolean(user.rows[0]?.memory_enabled),
      last_session_summary: user.rows[0]?.last_session_summary || null,
      profile,
    }
  } catch (error) {
    if (error?.code === '42703') {
      return {
        memory_enabled: false,
        last_session_summary: null,
        profile: { ...DEFAULT_PROFILE, user_id: userId },
      }
    }
    throw error
  }
}

async function resetProfile(userId) {
  await db.query(
    `UPDATE user_preference_profile SET
      preferred_response_length = 'medium',
      preferred_tone = 'balanced',
      responds_well_to_questions = TRUE,
      prefers_validation_over_advice = TRUE,
      average_message_length = 0,
      average_reply_speed_seconds = 0,
      mode_switch_count = 0,
      most_used_mode = 'Emotional support',
      repeat_sentiment_count = 0,
      last_updated = now()
     WHERE user_id = $1`,
    [userId],
  )
  await db.query(
    'UPDATE users SET preferences_reset_at = now() WHERE id = $1',
    [userId],
  )
}

function runningAverage(current, next, count) {
  if (!count || count <= 0) return next
  return Math.round((current * count + next) / (count + 1))
}

function modeLabelFromId(modeId) {
  return getModeLabel(modeId)
}

async function updateProfileAfterSession(userId, signals) {
  const profile = await getOrCreateProfile(userId)
  const sessionCount = (profile.session_count || 0) + 1

  const avgMsgLen = signals.user_avg_message_length || 0
  const avgReplyGap = signals.avg_reply_gap_seconds || 0
  const msgCount = signals.message_count || 0
  const modeSwitches = signals.mode_switches || 0
  const finalMode = signals.final_mode || profile.most_used_mode
  const repeatDetected = Boolean(signals.repeat_sentiment_detected)

  const newAvgMsgLen = runningAverage(
    profile.average_message_length || 0,
    avgMsgLen,
    profile.session_count || 0,
  )
  const newAvgReplySpeed = runningAverage(
    profile.average_reply_speed_seconds || 0,
    avgReplyGap,
    profile.session_count || 0,
  )
  const newAvgSessionLen = runningAverage(
    profile.average_session_length_messages || 0,
    msgCount,
    profile.session_count || 0,
  )
  const newModeSwitchCount =
    (profile.mode_switch_count || 0) + modeSwitches

  let mostUsedMode = profile.most_used_mode || 'Emotional support'
  if (finalMode) mostUsedMode = finalMode

  let repeatSentimentCount = profile.repeat_sentiment_count || 0
  if (repeatDetected) repeatSentimentCount += 1

  await db.query(
    `INSERT INTO session_length_history
      (user_id, user_avg_message_length, starting_mode, final_mode, mode_switches, repeat_sentiment_detected)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      avgMsgLen,
      signals.starting_mode || null,
      finalMode,
      modeSwitches,
      repeatDetected,
    ],
  )

  const history = await db.query(
    `SELECT user_avg_message_length, starting_mode, final_mode, mode_switches, repeat_sentiment_detected
     FROM session_length_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId],
  )
  const recent = history.rows || []

  let preferredResponseLength = 'medium'
  const shortSessions = recent.filter((r) => (r.user_avg_message_length || 0) < 80).length
  const longSessions = recent.filter((r) => (r.user_avg_message_length || 0) > 200).length
  if (shortSessions >= 3) preferredResponseLength = 'short'
  else if (longSessions >= 3) preferredResponseLength = 'long'

  let preferredTone = 'balanced'
  const warmSwitches = recent.filter((r) => WARM_MODES.has(r.final_mode)).length
  const directFinal = recent.filter((r) => DIRECT_MODES.has(r.final_mode)).length
  if (warmSwitches >= 3) preferredTone = 'warm'
  else if (directFinal >= 3) preferredTone = 'direct'

  let respondsWellToQuestions = true
  const repeatSessions = recent.filter((r) => r.repeat_sentiment_detected).length
  if (repeatSessions >= 3) respondsWellToQuestions = false

  let prefersValidationOverAdvice = true
  const validationSessions = recent.filter((r) => VALIDATION_MODES.has(r.final_mode)).length
  const adviceSessions = recent.filter((r) => DIRECT_MODES.has(r.final_mode)).length
  if (validationSessions >= 3) prefersValidationOverAdvice = true
  else if (adviceSessions >= 3) prefersValidationOverAdvice = false

  await db.query(
    `UPDATE user_preference_profile SET
      preferred_response_length = $2,
      preferred_tone = $3,
      responds_well_to_questions = $4,
      prefers_validation_over_advice = $5,
      average_message_length = $6,
      average_reply_speed_seconds = $7,
      mode_switch_count = $8,
      most_used_mode = $9,
      session_count = $10,
      average_session_length_messages = $11,
      repeat_sentiment_count = $12,
      last_updated = now()
     WHERE user_id = $1`,
    [
      userId,
      preferredResponseLength,
      preferredTone,
      respondsWellToQuestions,
      prefersValidationOverAdvice,
      newAvgMsgLen,
      newAvgReplySpeed,
      newModeSwitchCount,
      mostUsedMode,
      sessionCount,
      newAvgSessionLen,
      repeatSentimentCount,
    ],
  )

  return { sessionCount }
}

module.exports = {
  DEFAULT_PROFILE,
  getOrCreateProfile,
  getUserChatSettings,
  resetProfile,
  updateProfileAfterSession,
  modeLabelFromId,
}
