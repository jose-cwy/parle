import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

// Basic safety filter for self-harm keywords
const SAFETY_KEYWORDS = ['suicide','kill myself','end my life','hurt myself']

function checkSafety(text){
  const t = text.toLowerCase()
  return SAFETY_KEYWORDS.some(k=> t.includes(k))
}

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  const { text } = req.body
  if(!text) return res.status(400).json({error:'Missing text'})

  // Safety handling
  if(checkSafety(text)){
    // Do not persist harmful content; respond with helpline info
    const reply = 'I’m really sorry you’re feeling this way. If you are in immediate danger please call your local emergency number. For confidential support in the US call or text 988. You can also reach out to a trusted adult.'
    return res.status(200).json({reply})
  }

  // Persist user message
  await db.query('INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',[payload.id,'user',text,new Date()])

  // Placeholder AI response logic — replace with real model in V2.
  const reply = `Thanks for sharing — I’m here to listen. You said: "${text.slice(0,200)}"`;

  // Save assistant reply
  await db.query('INSERT INTO chat_memory (user_id,role,text,created_at) VALUES ($1,$2,$3,$4)',[payload.id,'assistant',reply,new Date()])

  res.status(200).json({reply})
}
