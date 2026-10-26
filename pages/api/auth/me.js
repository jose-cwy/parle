import db from '../../../lib/db'
import { withAdminFlag } from '../../../lib/parle/adminAuth'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req,res){
  const guard = await runApiPipeline(req, res)
  if (guard.handled) return
  const payload = guard.payload
  if(!payload) return res.status(200).json({user:null})

  try{
    const user = await db.query(
      'SELECT id,email,preferred_name,accepted_terms_at,accepted_terms_version,created_at,email_verified_at,email_verification_required FROM users WHERE id=$1',
      [payload.id]
    )

    if(!user.rows.length) return res.status(200).json({user:null})
    const { mustVerifyToUseApp, isEmailVerified, isLegacyUnverified } = require('../../../lib/parle/authAccess')
    const row = user.rows[0]
    return res.status(200).json({
      user: withAdminFlag({
        ...row,
        emailVerified: isEmailVerified(row),
        mustVerify: mustVerifyToUseApp(row),
        legacyUnverified: isLegacyUnverified(row),
      }),
    })
  }catch(error){
    const { isAuthSchemaError, meResponseForSchemaError } = require('../../../lib/parle/authSchemaFallback')
    if(isAuthSchemaError(error)){
      const decision = meResponseForSchemaError()
      return res.status(decision.status).json(decision.body)
    }

    console.error('auth_me_error', error)
    return res.status(500).json({error:'Unable to load session right now.'})
  }
}
