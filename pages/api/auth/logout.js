import { clearSessionCookie } from '../../../lib/auth'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req,res){
  const guard = await runApiPipeline(req, res)
  if (guard.handled) return
  clearSessionCookie(res)
  res.status(200).json({ok:true})
}
