import { setTermsAcceptanceCookie } from '../../../lib/auth'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default function handler(req,res){
  if(req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { tier: 'auth' })
  if (guard.handled) return

  try {
    setTermsAcceptanceCookie(res)
    return res.status(200).json({ ok: true })
  } catch (error) {
    if (error?.code === 'CONFIG_JWT_SECRET') {
      console.error('terms_accept_config_error', error.message)
      return res.status(503).json({ error: 'Unable to record acceptance. Server configuration is incomplete.' })
    }
    console.error('terms_accept_error', error)
    return res.status(500).json({ error: 'Something went wrong' })
  }
}
