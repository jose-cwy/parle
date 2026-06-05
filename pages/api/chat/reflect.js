import { buildReflectionPrompt, sentenceClamp } from '../../../lib/chatPrompt'
import { openaiChatComplete } from '../../../lib/openai'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { transcript, mood, style } = req.body || {}
  if (!transcript) return res.status(400).json({ error: 'Missing transcript' })

  const prompt = buildReflectionPrompt({ mood, style, transcript })

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
}

