import { openaiChatComplete } from '../../../lib/openai'
import { RECAP_PROMPT } from '../../../lib/parle/prompts'
import { getModeLabel } from '../../../lib/parle/modes'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { sanitizeTranscript } from '../../../lib/security/sanitize'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return

  try {
    const { transcript, modeId } = req.body || {}
    const safeTranscript = sanitizeTranscript(transcript)
    if (!safeTranscript) return res.status(400).json({ error: 'Missing transcript' })

    const modeLabel = getModeLabel(modeId || 'cross')

    const raw = await openaiChatComplete({
      messages: [
        {
          role: 'system',
          content: `${RECAP_PROMPT}\nCurrent mode label: ${modeLabel}`,
        },
        { role: 'user', content: safeTranscript },
      ],
      temperature: 0.2,
    })

    const cleaned = String(raw || '')
      .replace(/^```json?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {
        namesMentioned: 'none',
        whatHappened: cleaned.slice(0, 200),
        emotionalState: 'unclear',
        currentMode: modeLabel,
      }
    }

    return res.status(200).json({
      recap: {
        namesMentioned: parsed.namesMentioned || parsed.names || 'none',
        whatHappened: parsed.whatHappened || parsed.summary || '',
        emotionalState: parsed.emotionalState || parsed.emotion || '',
        currentMode: modeLabel,
      },
    })
  } catch (error) {
    return handleApiError(res, error, 'chat_recap')
  }
}
