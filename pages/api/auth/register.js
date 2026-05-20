import bcrypt from 'bcryptjs'
import db from '../../../lib/db'
import { signToken, setSessionCookie } from '../../../lib/auth'
import { sendVerificationEmail } from '../../../utils/resend'

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  if(!email || !password) return res.status(400).json({error:'Missing fields'})

  try{
    // Basic unique check
    const exists = await db.query('SELECT id FROM users WHERE email=$1',[email])
    if(exists.rows.length) return res.status(400).json({error:'Email already exists'})

    const hash = await bcrypt.hash(password, 10)
    const now = new Date()
    const result = await db.query('INSERT INTO users (email,password,created_at) VALUES ($1,$2,$3) RETURNING id,email',[email,hash,now])
    const token = signToken({ id: result.rows[0].id, email: result.rows[0].email })
    setSessionCookie(res, token)

    // Send verification email (fire-and-forget)
    sendVerificationEmail(email).catch((e)=>console.warn('Resend error', e))

    return res.status(201).json({user: result.rows[0]})
  } catch (error) {
    if (error?.code === '23505') return res.status(400).json({error:'Email already exists'})
    if (error?.code === '42P01') return res.status(500).json({error:'Database schema is not installed. Apply database/schema.sql.'})
    console.error('register_error', error)
    return res.status(500).json({error:'Unable to create account right now. Please try again.'})
  }
}
