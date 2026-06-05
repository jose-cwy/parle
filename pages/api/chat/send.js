import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { buildSystemPrompt, sentenceClamp } from '../../../lib/chatPrompt'
import { openaiChatComplete } from '../../../lib/openai'

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  const { text, mood, style } = req.body || {}
  if(!text) return res.status(400).json({error:'Missing text'})

  if (containsCrisisLanguage(text)) {
    return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
  }

  // Persist user message
  await db.query('INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',[payload.id,'user',text,new Date()])

  let reply = ''
  const system = buildSystemPrompt({ mood, style })

  // Load a small window of recent context so user doesn't repeat themselves.
  const history = await db.query(
    'SELECT role,text FROM chat_memory WHERE user_id=$1 ORDER BY created_at DESC LIMIT 14',
    [payload.id],
  )
  const recent = (history.rows || []).reverse().map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.text || '').slice(0, 1200),
  }))

  try {
    reply = await openaiChatComplete({
      messages: [
        { role: 'system', content: system },
        ...recent,
        { role: 'user', content: String(text) },
      ],
      temperature: 0.65,
    })
  } catch (error) {
    // Fallback: still keep it short and human.
    reply = `I hear you. ${String(text).slice(0, 140)}. What’s the hardest part of this right now?`
    console.error('chat_model_error', error)
  }

  reply = sentenceClamp(reply, 5)

  // Save assistant reply
  await db.query('INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',[payload.id,'assistant',reply,new Date()])

  res.status(200).json({reply})
}
