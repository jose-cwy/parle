import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { openaiChatComplete } from '../../../lib/openai'
import { RECAP_PROMPT } from '../../../lib/parle/prompts'
import { getModeLabel } from '../../../lib/parle/modes'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { transcript, modeId } = req.body || {}
  if (!transcript) return res.status(400).json({ error: 'Missing transcript' })

  const token = getTokenFromReq(req)
  const payload = token ? verifyToken(token) : null
  if (token && !payload) return res.status(401).json({ error: 'Unauthorized' })

  const modeLabel = getModeLabel(modeId || 'emotional')

  try {
    const raw = await openaiChatComplete({
      messages: [
        {
          role: 'system',
          content: `${RECAP_PROMPT}\nCurrent mode label: ${modeLabel}`,
        },
        { role: 'user', content: String(transcript).slice(0, 3000) },
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
    console.error('recap_error', error)
    return res.status(500).json({ error: 'Unable to generate recap' })
  }
}
