import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req,res){
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  const { id } = req.query
  const entry = await db.query('SELECT id,user_id,content,created_at FROM diary WHERE id=$1',[id])
  if(!entry.rows.length) return res.status(404).json({error:'Not found'})
  if(entry.rows[0].user_id !== payload.id) return res.status(403).json({error:'Forbidden'})

  if(req.method === 'GET') return res.status(200).json(entry.rows[0])

  if(req.method === 'PUT'){
    const { content } = req.body
    const r = await db.query('UPDATE diary SET content=$1 WHERE id=$2 RETURNING id,content,created_at',[content,id])
    return res.status(200).json(r.rows[0])
  }

  if(req.method === 'DELETE'){
    await db.query('DELETE FROM diary WHERE id=$1',[id])
    return res.status(200).json({ok:true})
  }

  res.status(405).end()
}
