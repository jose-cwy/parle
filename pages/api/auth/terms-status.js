import { getTermsAcceptanceFromReq } from '../../../lib/auth'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const guard = runApiPipeline(req, res)
  if (guard.handled) return

  return res.status(200).json({
    accepted: Boolean(getTermsAcceptanceFromReq(req)),
  })
}
