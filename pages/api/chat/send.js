import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { openaiChatComplete } from '../../../lib/openai'
import { buildChatCompletionMessages, sentenceClamp } from '../../../lib/parle/chatComplete'
import { getUserChatSettings } from '../../../lib/parle/preferences'
import { getModeLabel } from '../../../lib/parle/modes'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  const {
    text,
    modeId,
    dontTextStep,
    dontTextMessageCount,
    contextRecap,
    crossSessionSummary,
    hiddenInjections,
    isNewSession,
  } = req.body || {}

  if (!text) return res.status(400).json({ error: 'Missing text' })

  if (containsCrisisLanguage(text)) {
    await db.query(
      'INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',
      [payload.id, 'user', text, new Date()],
    )
    await db.query(
      'INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',
      [payload.id, 'assistant', CRISIS_SAFETY_REPLY, new Date()],
    )
    return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
  }

  await db.query(
    'INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',
    [payload.id, 'user', text, new Date()],
  )

  const settings = await getUserChatSettings(payload.id)
  const crossSummary =
    isNewSession && settings.memory_enabled ? settings.last_session_summary : crossSessionSummary

  const history = await db.query(
    'SELECT role,text FROM chat_memory WHERE user_id=$1 ORDER BY created_at DESC LIMIT 14',
    [payload.id],
  )
  const recent = (history.rows || [])
    .reverse()
    .slice(0, -1)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      text: m.text,
    }))

  const messages = buildChatCompletionMessages({
    modeId: modeId || 'listen',
    dontTextStep,
    dontTextMessageCount,
    preferenceProfile: settings.profile,
    contextRecap: contextRecap
      ? { ...contextRecap, currentMode: contextRecap.currentMode || getModeLabel(modeId) }
      : null,
    crossSessionSummary: crossSummary,
    hiddenInjections,
    conversationHistory: recent,
    userText: text,
  })

  let reply = ''
  try {
    reply = await openaiChatComplete({ messages, temperature: 0.65 })
  } catch (error) {
    reply = `Yeah, that's a lot. ${String(text).slice(0, 120)}. What's sitting heaviest right now?`
    console.error('chat_model_error', error)
  }

  reply = sentenceClamp(reply, 8)

  await db.query(
    'INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',
    [payload.id, 'assistant', reply, new Date()],
  )

  res.status(200).json({ reply })
}
