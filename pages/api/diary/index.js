import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

function dbErrorResponse(res, error, context){
  console.error(`${context}_error`, error)
  if(error?.code === '42P01'){
    return res.status(500).json({ error: 'Database schema is not installed. Apply database/schema.sql.' })
  }
  return res.status(500).json({ error: 'Unable to save diary entries right now. Please try again.' })
}

export default async function handler(req, res){
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({ error: 'Unauthorized' })

  try {
    if(req.method === 'GET'){
      const rows = await db.query(
        'SELECT id, content, created_at FROM diary WHERE user_id = $1 ORDER BY created_at DESC',
        [payload.id]
      )
      return res.status(200).json(rows.rows)
    }

    if(req.method === 'POST'){
      const { content } = req.body || {}
      if(!content || !String(content).trim()){
        return res.status(400).json({ error: 'Write something before saving your entry.' })
      }

      const now = new Date()
      const r = await db.query(
        'INSERT INTO diary (user_id, content, created_at) VALUES ($1, $2, $3) RETURNING id, content, created_at',
        [payload.id, String(content).trim(), now]
      )
      return res.status(201).json(r.rows[0])
    }

    return res.status(405).end()
  } catch (error) {
    return dbErrorResponse(res, error, 'diary_index')
  }
}
