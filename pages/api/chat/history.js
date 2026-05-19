import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req,res){
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  const r = await db.query('SELECT role,text,created_at FROM chat_memory WHERE user_id=$1 ORDER BY created_at ASC LIMIT 200',[payload.id])
  res.status(200).json(r.rows)
}
