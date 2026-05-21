import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import db from '../../../lib/db'

export default async function handler(req,res){
  const token = getTokenFromReq(req)
  if(!token) return res.status(200).json({user:null})
  const payload = verifyToken(token)
  if(!payload) return res.status(200).json({user:null})

  try{
    const user = await db.query(
      'SELECT id,email,accepted_terms_at,accepted_terms_version,created_at FROM users WHERE id=$1',
      [payload.id]
    )

    if(!user.rows.length) return res.status(200).json({user:null})
    return res.status(200).json({user: user.rows[0]})
  }catch(error){
    if(error?.code === '42703'){
      // Backward-compatible fallback while the database is still on the pre-terms schema.
      const legacyUser = await db.query(
        'SELECT id,email,created_at FROM users WHERE id=$1',
        [payload.id]
      )

      if(!legacyUser.rows.length) return res.status(200).json({user:null})

      return res.status(200).json({
        user: {
          ...legacyUser.rows[0],
          accepted_terms_at: null,
          accepted_terms_version: null
        }
      })
    }

    console.error('auth_me_error', error)
    return res.status(500).json({error:'Unable to load session right now.'})
  }
}
