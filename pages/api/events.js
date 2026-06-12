import { runApiPipeline } from '../../lib/security/pipeline'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { tier: 'default' })
  if (guard.handled) return

  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  res.status(204).end()
}
