import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import db from '../../../lib/db'

export default async function handler(req,res){
  const token = getTokenFromReq(req)
  if(!token) return res.status(401).json({error:'Unauthorized'})
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})
  const user = await db.query('SELECT id,email,created_at FROM users WHERE id=$1',[payload.id])
  if(!user.rows.length) return res.status(404).json({error:'Not found'})
  res.status(200).json(user.rows[0])
}
