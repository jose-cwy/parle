import db from '../../../lib/db'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req,res){
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return
  const payload = guard.payload

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
