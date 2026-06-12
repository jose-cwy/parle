import { openaiChatComplete } from '../../../lib/openai'
import { SESSION_TITLE_PROMPT } from '../../../lib/parle/prompts'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { sanitizeChatMessage } from '../../../lib/security/sanitize'

const GENERIC_TITLES = /^new chat$|^heartbreak$|^venting$|^need help$|^chat$|^conversation$/i

function cleanTitle(raw) {
  return String(raw || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^title:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Missing messages' })
  }

  const transcript = messages
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .slice(0, 6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${sanitizeChatMessage(m.text).slice(0, 500)}`)
    .join('\n')

  if (!transcript.includes('User:')) {
    return res.status(400).json({ error: 'Missing user message' })
  }

  try {
    const raw = await openaiChatComplete({
      messages: [
        { role: 'system', content: SESSION_TITLE_PROMPT },
        { role: 'user', content: transcript.slice(0, 2000) },
      ],
      temperature: 0.3,
    })

    const title = cleanTitle(raw)
    if (!title || GENERIC_TITLES.test(title)) {
      return res.status(200).json({ title: null })
    }

    return res.status(200).json({ title })
  } catch (error) {
    return handleApiError(res, error, 'session_title')
  }
}
