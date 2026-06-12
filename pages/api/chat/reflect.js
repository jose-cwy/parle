import { buildReflectionPrompt, sentenceClamp } from '../../../lib/chatPrompt'
import { openaiChatComplete } from '../../../lib/openai'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { sanitizeTranscript } from '../../../lib/security/sanitize'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return

  try {
    const { transcript, mood, style } = req.body || {}
    const safeTranscript = sanitizeTranscript(transcript)
    if (!safeTranscript) return res.status(400).json({ error: 'Missing transcript' })

    const prompt = buildReflectionPrompt({ mood, style, transcript: safeTranscript })

    let reflection = ''
    try {
      reflection = await openaiChatComplete({
        messages: [
          { role: 'system', content: 'You are a careful, concise writing assistant.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.5,
      })
    } catch (error) {
      console.error('reflect_model_error', error)
      reflection = 'Mood: \nTrigger: \nFeeling: \nNeeded: \nReminder: '
    }

    reflection = sentenceClamp(reflection, 10)
    return res.status(200).json({ reflection })
  } catch (error) {
    return handleApiError(res, error, 'chat_reflect')
  }
}
