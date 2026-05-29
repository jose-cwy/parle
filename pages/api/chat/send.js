import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { containsCrisisLanguage, CRISIS_SAFETY_REPLY } from '../../../lib/chatSafety'

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  const { text } = req.body
  if(!text) return res.status(400).json({error:'Missing text'})

  if (containsCrisisLanguage(text)) {
    return res.status(200).json({ reply: CRISIS_SAFETY_REPLY, safety: true })
  }

  // Persist user message
  await db.query('INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',[payload.id,'user',text,new Date()])

  // Placeholder AI response logic — replace with real model in V2.
  const reply = `Thanks for sharing — I’m here to listen. You said: "${text.slice(0,200)}"`;

  // Save assistant reply
  await db.query('INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',[payload.id,'assistant',reply,new Date()])

  res.status(200).json({reply})
}
