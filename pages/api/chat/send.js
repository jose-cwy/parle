import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'
import { buildChatCompletionMessages } from '../../../lib/parle/chatComplete'
import { streamChatReply } from '../../../lib/parle/chatStreamResponse'
import { getUserChatSettings } from '../../../lib/parle/preferences'
import { getModeLabel } from '../../../lib/parle/modes'
import { truncateChatMemory } from '../../../lib/parle/chatMemory'

export const config = {
  api: {
    responseLimit: false,
  },
}

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
    images,
    isEdit,
    dbKeepCount,
    messages: clientMessages,
  } = req.body || {}

  if (!text && !(Array.isArray(images) && images.length)) {
    return res.status(400).json({ error: 'Missing text' })
  }

  const userText = String(text || '').trim() || '(See attached image)'

  if (containsCrisisLanguage(userText)) {
    await db.query(
      'INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',
      [payload.id, 'user', userText, new Date()],
    )
    await db.query(
      'INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',
      [payload.id, 'assistant', CRISIS_SAFETY_REPLY, new Date()],
    )
    return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
  }

  if (isEdit && typeof dbKeepCount === 'number') {
    await truncateChatMemory(payload.id, dbKeepCount)
  }

  await db.query(
    'INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',
    [payload.id, 'user', userText, new Date()],
  )

  const settings = await getUserChatSettings(payload.id)
  const crossSummary =
    isNewSession && settings.memory_enabled ? settings.last_session_summary : crossSessionSummary

  let recent
  if (isEdit && Array.isArray(clientMessages)) {
    recent = clientMessages
      .filter((m) => m?.role === 'user' || m?.role === 'assistant')
      .slice(-14)
      .map((m) => ({
        role: m.role,
        text: m.text,
      }))
  } else {
    const history = await db.query(
      'SELECT role,text FROM chat_memory WHERE user_id=$1 ORDER BY created_at DESC LIMIT 14',
      [payload.id],
    )
    recent = (history.rows || [])
      .reverse()
      .slice(0, -1)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        text: m.text,
      }))
  }

  const messages = buildChatCompletionMessages({
    modeId: modeId || 'emotional',
    dontTextStep,
    dontTextMessageCount,
    preferenceProfile: settings.profile,
    contextRecap: contextRecap
      ? { ...contextRecap, currentMode: contextRecap.currentMode || getModeLabel(modeId) }
      : null,
    crossSessionSummary: crossSummary,
    hiddenInjections,
    conversationHistory: recent,
    userText,
    images,
  })

  const fallbackReply = `Yeah, that's a lot. ${String(userText).slice(0, 120)}. What's sitting heaviest right now?`

  const reply = await streamChatReply(res, {
    messages,
    temperature: 0.65,
    fallbackReply,
  })

  await db.query(
    'INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',
    [payload.id, 'assistant', reply, new Date()],
  )
}
