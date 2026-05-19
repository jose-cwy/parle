import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import db from '../../../lib/db'

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  await db.query(`INSERT INTO gamification (user_id,streaks,entries_count,quotes_read,chat_interactions,badges)
    VALUES ($1,0,0,1,0,ARRAY[]::text[])
    ON CONFLICT (user_id) DO UPDATE SET quotes_read = gamification.quotes_read + 1`,[payload.id])

  return res.status(200).json({ok:true})
}
