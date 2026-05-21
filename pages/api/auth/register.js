import bcrypt from 'bcryptjs'
import db from '../../../lib/db'
import {
  TERMS_VERSION,
  clearTermsAcceptanceCookie,
  getTermsAcceptanceFromReq,
  signToken,
  setSessionCookie
} from '../../../lib/auth'
import { sendVerificationEmail } from '../../../utils/resend'

export default async function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  if(!email || !password) return res.status(400).json({error:'Missing fields'})
  if(password.length < 8) return res.status(400).json({error:'Password must be at least 8 characters'})

  // Enforce T&C acceptance on the server so signup cannot be bypassed with a direct API call.
  const acceptedTerms = getTermsAcceptanceFromReq(req)
  if(!acceptedTerms) return res.status(403).json({error:'Please review and accept the terms before creating an account.'})

  try{
    // Basic unique check
    const exists = await db.query('SELECT id FROM users WHERE email=$1',[email])
    if(exists.rows.length) return res.status(400).json({error:'Email already exists'})

    const hash = await bcrypt.hash(password, 10)
    const now = new Date()
    const result = await db.query(
      `INSERT INTO users (email,password,accepted_terms_at,accepted_terms_version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,email,accepted_terms_at,accepted_terms_version`,
      [email,hash,now,TERMS_VERSION,now,now]
    )
    const token = signToken({ id: result.rows[0].id, email: result.rows[0].email })
    setSessionCookie(res, token)
    clearTermsAcceptanceCookie(res)

    // Send verification email (fire-and-forget)
    sendVerificationEmail(email).catch((e)=>console.warn('Resend error', e))

    return res.status(201).json({user: result.rows[0]})
  } catch (error) {
    if (error?.code === '23505') return res.status(400).json({error:'Email already exists'})
    if (error?.code === '42P01') return res.status(500).json({error:'Database schema is not installed. Apply database/schema.sql.'})
    if (error?.code === '42703') return res.status(500).json({error:'Database schema is missing the new terms columns. Re-apply database/schema.sql.'})
    console.error('register_error', error)
    return res.status(500).json({error:'Unable to create account right now. Please try again.'})
  }
}
