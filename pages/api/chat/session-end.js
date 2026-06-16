import db from '../../../lib/db'
import { runApiPipeline } from '../../../lib/security/pipeline'
import { openaiChatComplete } from '../../../lib/openai'
import { SESSION_SUMMARY_PROMPT } from '../../../lib/parle/prompts'
import { updateProfileAfterSession } from '../../../lib/parle/preferences'

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

      await updateProfileAfterSession(payload.id, {
        message_count,
        user_avg_message_length,
        avg_reply_gap_seconds,
        mode_switches,
        starting_mode,
        final_mode,
        repeat_sentiment_detected,
      })
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

    if (memoryEnabled && (message_count || 0) > 0) {
      let sessionTranscript = String(transcript || '').trim()
      if (!sessionTranscript) {
        const history = await db.query(
          'SELECT role, text FROM chat_memory WHERE user_id = $1 ORDER BY created_at ASC',
          [payload.id],
        )
        sessionTranscript = (history.rows || [])
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.text || '').slice(0, 800)}`)
          .join('\n')
      }

      if (sessionTranscript.trim()) {
        const summary = await openaiChatComplete({
          messages: [
            { role: 'system', content: SESSION_SUMMARY_PROMPT },
            { role: 'user', content: sessionTranscript.slice(0, 6000) },
          ],
          temperature: 0.4,
        })
        await db.query('UPDATE users SET last_session_summary = $1 WHERE id = $2', [
          String(summary || '').trim(),
          payload.id,
        ])
      }
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703') {
      return res.status(200).json({ ok: true, skipped: true })
    }
    console.error('session_end_error', error)
    return res.status(500).json({ error: 'Unable to end session' })
  }
}
