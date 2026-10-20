import db from '../../../lib/db'
import { runApiPipeline } from '../../../lib/security/pipeline'
import { encrypt, decrypt } from '../../../lib/security/encryption'
import { openaiChatComplete } from '../../../lib/openai'
import { SESSION_SUMMARY_PROMPT } from '../../../lib/parle/prompts'
import { getOrCreateProfile, updateProfileAfterSession } from '../../../lib/parle/preferences'
import { updateLivingProfileAfterSession } from '../../../lib/parle/livingProfile'
import { getRecentReplyFeedback } from '../../../lib/parle/feedbackDb'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return
  const payload = guard.payload

  const {
    sessionId,
    message_count,
    user_avg_message_length,
    avg_reply_gap_seconds,
    mode_switches,
    starting_mode,
    final_mode,
    silence_after_response_count,
    repeat_sentiment_detected,
    session_length_minutes,
    transcript,
  } = req.body || {}

  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

  try {
    const userRow = await db.query(
      `SELECT memory_enabled, personalisation_enabled
       FROM users WHERE id = $1`,
      [payload.id],
    )
    const userSettings = userRow.rows[0] || {}
    const personalisationEnabled = Boolean(userSettings.personalisation_enabled)
    const trainingEligible = true

    if (personalisationEnabled) {
      try {
        await db.query(
          `INSERT INTO session_signals
            (session_id, user_id, message_count, user_avg_message_length, avg_reply_gap_seconds,
             mode_switches, final_mode, silence_after_response_count, repeat_sentiment_detected,
             session_length_minutes, training_eligible)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (session_id) DO UPDATE SET
             message_count = EXCLUDED.message_count,
             user_avg_message_length = EXCLUDED.user_avg_message_length,
             avg_reply_gap_seconds = EXCLUDED.avg_reply_gap_seconds,
             mode_switches = EXCLUDED.mode_switches,
             final_mode = EXCLUDED.final_mode,
             silence_after_response_count = EXCLUDED.silence_after_response_count,
             repeat_sentiment_detected = EXCLUDED.repeat_sentiment_detected,
             session_length_minutes = EXCLUDED.session_length_minutes,
             training_eligible = EXCLUDED.training_eligible`,
          [
            sessionId,
            payload.id,
            message_count || 0,
            user_avg_message_length || 0,
            avg_reply_gap_seconds || 0,
            mode_switches || 0,
            final_mode || null,
            silence_after_response_count || 0,
            Boolean(repeat_sentiment_detected),
            session_length_minutes || 0,
            trainingEligible,
          ],
        )
      } catch (error) {
        if (error?.code !== '42P01' && error?.code !== '42703') throw error
        console.warn('session_signals_write_skipped', error.code)
      }

      try {
        await updateProfileAfterSession(payload.id, {
          message_count,
          user_avg_message_length,
          avg_reply_gap_seconds,
          mode_switches,
          starting_mode,
          final_mode,
          repeat_sentiment_detected,
        })
      } catch (error) {
        console.error('session_preference_update_error', error)
      }
    } else {
      await db.query(
        `INSERT INTO session_signals (session_id, user_id, training_eligible)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id) DO UPDATE SET
           training_eligible = EXCLUDED.training_eligible`,
        [sessionId, payload.id, trainingEligible],
      )
    }

    const memoryEnabled = Boolean(userSettings.memory_enabled)

    let sessionTranscript = String(transcript || '').trim()
    if (!sessionTranscript && (personalisationEnabled || memoryEnabled) && (message_count || 0) > 0) {
      const history = await db.query(
        'SELECT role, text FROM chat_memory WHERE user_id = $1 ORDER BY created_at ASC',
        [payload.id],
      )
      sessionTranscript = (history.rows || [])
        .map((m) => {
          const text = decrypt(m.text || '').slice(0, 800)
          return `${m.role === 'user' ? 'User' : 'Assistant'}: ${text}`
        })
        .join('\n')
    }

    if (personalisationEnabled && (message_count || 0) > 0) {
      try {
        const knobs = await getOrCreateProfile(payload.id)
        const feedbackRows = await getRecentReplyFeedback({ userId: payload.id, limit: 6 }).catch(() => [])
        await updateLivingProfileAfterSession(payload.id, {
          signals: {
            user_avg_message_length,
            final_mode,
            repeat_sentiment_detected,
            preferred_response_length: knobs.preferred_response_length,
            preferred_tone: knobs.preferred_tone,
            responds_well_to_questions: knobs.responds_well_to_questions,
            prefers_validation_over_advice: knobs.prefers_validation_over_advice,
          },
          transcript: sessionTranscript.slice(0, 4000),
          hour: new Date().getHours(),
          feedbackRows,
        })
      } catch (error) {
        console.error('session_living_profile_error', error)
      }
    }

    if (memoryEnabled && (message_count || 0) > 0 && sessionTranscript.trim()) {
      const summary = await openaiChatComplete({
        messages: [
          { role: 'system', content: SESSION_SUMMARY_PROMPT },
          { role: 'user', content: sessionTranscript.slice(0, 6000) },
        ],
        temperature: 0.4,
      })
      const plain = String(summary || '').trim()
      await db.query('UPDATE users SET last_session_summary = $1 WHERE id = $2', [
        plain ? encrypt(plain) : null,
        payload.id,
      ])
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('session_end_error', error)
    return res.status(500).json({ error: 'Unable to end session' })
  }
}
