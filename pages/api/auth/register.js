import bcrypt from 'bcryptjs'
import db from '../../../lib/db'
import { sendVerificationEmail } from '../../../utils/resend'

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  if(!email || !password) return res.status(400).json({error:'Missing fields'})

  // Basic unique check
  const exists = await db.query('SELECT id FROM users WHERE email=$1',[email])
  if(exists.rows.length) return res.status(400).json({error:'Email already exists'})

  const hash = await bcrypt.hash(password, 10)
  const now = new Date()
  const result = await db.query('INSERT INTO users (email,password,created_at) VALUES ($1,$2,$3) RETURNING id,email',[email,hash,now])

  // Send verification email (non-blocking)
  try{ sendVerificationEmail(email) }catch(e){ console.warn('Resend error', e) }

  res.status(201).json({user: result.rows[0]})
}
