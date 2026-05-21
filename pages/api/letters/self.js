import db from '../../../lib/db'
import { getSessionPayload } from '../../../lib/auth'

export default async function handler(req,res){
  const session = getSessionPayload(req)
  if(!session) return res.status(401).json({ error: 'Unauthorized' })

  try{
    if(req.method === 'GET'){
      const result = await db.query(
        `SELECT id,user_id,content,is_completed,completed_at,created_at,updated_at
         FROM letters_to_self
         WHERE user_id=$1
         LIMIT 1`,
        [session.id]
      )

      if(!result.rows.length) return res.status(200).json({ letter: null })

      const letter = result.rows[0]

      // Once a letter is completed, the API stops returning its content.
      return res.status(200).json({
        letter: {
          ...letter,
          content: letter.is_completed ? null : letter.content
        }
      })
    }

    if(req.method === 'POST' || req.method === 'PUT'){
      const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
      if(!content) return res.status(400).json({ error: 'Please write something before saving.' })

      const existing = await db.query(
        'SELECT id,is_completed FROM letters_to_self WHERE user_id=$1 LIMIT 1',
        [session.id]
      )

      if(existing.rows[0]?.is_completed){
        return res.status(409).json({ error: 'This letter has already been completed and sealed.' })
      }

      const now = new Date()

      const saved = await db.query(
        `INSERT INTO letters_to_self (user_id,content,is_completed,created_at,updated_at)
         VALUES ($1,$2,FALSE,$3,$3)
         ON CONFLICT (user_id)
         DO UPDATE SET content=EXCLUDED.content, updated_at=EXCLUDED.updated_at
         RETURNING id,user_id,content,is_completed,completed_at,created_at,updated_at`,
        [session.id, content, now]
      )

      return res.status(200).json({ letter: saved.rows[0] })
    }

    if(req.method === 'PATCH'){
      const existing = await db.query(
        `SELECT id,is_completed
         FROM letters_to_self
         WHERE user_id=$1
         LIMIT 1`,
        [session.id]
      )

      if(!existing.rows.length){
        return res.status(404).json({ error: 'Save a draft before completing your letter.' })
      }

      if(existing.rows[0].is_completed){
        return res.status(409).json({ error: 'This letter is already completed.' })
      }

      const completed = await db.query(
        `UPDATE letters_to_self
         SET is_completed=TRUE, completed_at=now(), updated_at=now()
         WHERE user_id=$1
         RETURNING id,user_id,is_completed,completed_at,created_at,updated_at`,
        [session.id]
      )

      return res.status(200).json({ letter: completed.rows[0] })
    }

    return res.status(405).end()
  }catch(error){
    if(error?.code === '42P01'){
      return res.status(500).json({ error: 'Letters table is missing. Apply database/schema.sql.' })
    }

    console.error('letter_self_error', error)
    return res.status(500).json({ error: 'Unable to process your letter right now.' })
  }
}
