import bcrypt from 'bcryptjs'
import db from '../../../lib/db'
import { signToken, setSessionCookie } from '../../../lib/auth'

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  const user = await db.query('SELECT id,email,password FROM users WHERE email=$1',[email])
  if(!user.rows.length) return res.status(401).json({error:'Invalid'})
  const u = user.rows[0]
  const ok = await bcrypt.compare(password, u.password)
  if(!ok) return res.status(401).json({error:'Invalid'})

  const token = signToken({ id: u.id, email: u.email })
  setSessionCookie(res, token)

  /* Detect first-time user: no letter row = never written their first letter */
  let firstTime = false
  try {
    const hasLetter = await db.query(
      'SELECT 1 FROM letters_to_self WHERE user_id=$1 LIMIT 1',
      [u.id]
    )
    firstTime = hasLetter.rows.length === 0
  } catch (_) { /* table may not exist in older schemas — ignore */ }

  res.status(200).json({ ok: true, firstTime })
}
