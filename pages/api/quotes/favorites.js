import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

export default async function handler(req,res){
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({error:'Unauthorized'})

  if(req.method === 'GET'){
    const rows = await db.query('SELECT quote_id FROM quote_favorites WHERE user_id=$1',[payload.id])
    return res.status(200).json(rows.rows.map(r=>r.quote_id))
  }

  if(req.method === 'POST'){
    const { quoteId } = req.body
    await db.query('INSERT INTO quote_favorites (user_id,quote_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[payload.id,quoteId])
    return res.status(200).json({ok:true})
  }

  if(req.method === 'DELETE'){
    const { quoteId } = req.body
    await db.query('DELETE FROM quote_favorites WHERE user_id=$1 AND quote_id=$2',[payload.id,quoteId])
    return res.status(200).json({ok:true})
  }

  return res.status(405).end()
}
