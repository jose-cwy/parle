import db from '../../../lib/db'
import { getTokenFromReq, verifyToken } from '../../../lib/auth'

function dbErrorResponse(res, error, context){
  console.error(`${context}_error`, error)
  if(error?.code === '42P01'){
    return res.status(500).json({ error: 'Database schema is not installed. Apply database/schema.sql.' })
  }
  return res.status(500).json({ error: 'Unable to update diary entry right now. Please try again.' })
}

export default async function handler(req, res){
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if(!payload) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.query
  if(!id) return res.status(400).json({ error: 'Missing entry id' })

  try {
    const entry = await db.query(
      'SELECT id, user_id, content, created_at FROM diary WHERE id = $1',
      [id]
    )
    if(!entry.rows.length) return res.status(404).json({ error: 'Not found' })
    if(entry.rows[0].user_id !== payload.id) return res.status(403).json({ error: 'Forbidden' })

    if(req.method === 'GET') return res.status(200).json(entry.rows[0])

    if(req.method === 'PUT'){
      const { content } = req.body || {}
      if(!content || !String(content).trim()){
        return res.status(400).json({ error: 'Write something before saving your entry.' })
      }

      const r = await db.query(
        'UPDATE diary SET content = $1 WHERE id = $2 RETURNING id, content, created_at',
        [String(content).trim(), id]
      )
      return res.status(200).json(r.rows[0])
    }

    if(req.method === 'DELETE'){
      await db.query('DELETE FROM diary WHERE id = $1', [id])
      return res.status(200).json({ ok: true })
    }

    return res.status(405).end()
  } catch (error) {
    return dbErrorResponse(res, error, 'diary_id')
  }
}
