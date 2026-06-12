import db from '../../../lib/db'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req,res){
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return
  const payload = guard.payload

  if(req.method === 'GET'){
    const r = await db.query('SELECT streaks,entries_count,quotes_read,chat_interactions,badges FROM gamification WHERE user_id=$1',[payload.id])
    if(!r.rows.length) return res.status(200).json({streaks:0,entries_count:0,quotes_read:0,chat_interactions:0,badges:[]})
    return res.status(200).json(r.rows[0])
  }

  if(req.method === 'POST'){
    const { deltaEntries=0, deltaQuotes=0, deltaChat=0 } = req.body
    // Upsert simple counters
    await db.query(`INSERT INTO gamification (user_id,streaks,entries_count,quotes_read,chat_interactions,badges)
      VALUES ($1,0,$2,$3,$4,ARRAY[]::text[])
      ON CONFLICT (user_id) DO UPDATE SET entries_count = gamification.entries_count + $2, quotes_read = gamification.quotes_read + $3, chat_interactions = gamification.chat_interactions + $4`,[payload.id, deltaEntries, deltaQuotes, deltaChat])
    return res.status(200).json({ok:true})
  }

  res.status(405).end()
}
