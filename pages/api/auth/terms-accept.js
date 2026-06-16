import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { tier: 'auth' })
  if (guard.handled) return

  try {
    const { setTermsAcceptanceCookie } = await import('../../../lib/auth')
    setTermsAcceptanceCookie(res)
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('terms_accept_error', error)
    return res.status(500).json({
      error: 'Unable to record acceptance.',
      hint: error?.message || 'Unknown error',
    })
  }
}
