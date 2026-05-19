import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req,res){
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  if(req.method === 'GET'){
    const rows = await db.query('SELECT id,content,created_at FROM diary WHERE user_id=$1 ORDER BY created_at DESC',[payload.id])
    return res.status(200).json(rows.rows)
  }

  if(req.method === 'POST'){
    const { content } = req.body
    const now = new Date()
    const r = await db.query('INSERT INTO diary (user_id,content,created_at) VALUES ($1,$2,$3) RETURNING id,content,created_at',[payload.id,content,now])
    return res.status(201).json(r.rows[0])
  }

  res.status(405).end()
}
