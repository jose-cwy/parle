import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import db from '../../../lib/db'

export default async function handler(req,res){
  const token = getTokenFromReq(req)
  if(!token) return res.status(200).json({user:null})
  const payload = verifyToken(token)
  if(!payload) return res.status(200).json({user:null})
  const user = await db.query('SELECT id,email,created_at FROM users WHERE id=$1',[payload.id])
  if(!user.rows.length) return res.status(200).json({user:null})
  res.status(200).json({user: user.rows[0]})
}
