import db from '../../../lib/db'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return
  const payload = guard.payload

  await db.query(`INSERT INTO gamification (user_id,streaks,entries_count,quotes_read,chat_interactions,badges)
    VALUES ($1,0,0,1,0,ARRAY[]::text[])
    ON CONFLICT (user_id) DO UPDATE SET quotes_read = gamification.quotes_read + 1`,[payload.id])

  return res.status(200).json({ok:true})
}
