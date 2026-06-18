import { clearSessionCookie } from '../../../lib/auth'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default function handler(req,res){
  const guard = runApiPipeline(req, res)
  if (guard.handled) return
  clearSessionCookie(res)
  res.status(200).json({ok:true})
}
