import db from '../../../lib/db'
import { withAdminFlag } from '../../../lib/parle/adminAuth'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req,res){
  const guard = runApiPipeline(req, res)
  if (guard.handled) return
  const payload = guard.payload
  if(!payload) return res.status(200).json({user:null})

  try{
    const user = await db.query(
      'SELECT id,email,preferred_name,accepted_terms_at,accepted_terms_version,created_at,email_verified_at FROM users WHERE id=$1',
      [payload.id]
    )

    if(!user.rows.length) return res.status(200).json({user:null})
    const { mustVerifyToUseApp, isEmailVerified } = require('../../../lib/parle/authAccess')
    const row = user.rows[0]
    return res.status(200).json({
      user: withAdminFlag({
        ...row,
        emailVerified: isEmailVerified(row),
        mustVerify: mustVerifyToUseApp(row),
      }),
    })
  }catch(error){
    if(error?.code === '42703'){
      // Backward-compatible fallback while the database is still on the pre-terms schema.
      const legacyUser = await db.query(
        'SELECT id,email,created_at FROM users WHERE id=$1',
        [payload.id]
      )

      if(!legacyUser.rows.length) return res.status(200).json({user:null})

      return res.status(200).json({
        user: withAdminFlag({
          ...legacyUser.rows[0],
          preferred_name: null,
          accepted_terms_at: null,
          accepted_terms_version: null
        })
      })
    }

    console.error('auth_me_error', error)
    return res.status(500).json({error:'Unable to load session right now.'})
  }
}
