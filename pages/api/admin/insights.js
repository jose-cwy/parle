import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { requireAdminUser } from '../../../lib/parle/adminAuth'
import { loadInsights } from '../../../lib/parle/insights'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'default' })
  if (guard.handled) return

  if (req.method !== 'GET') return res.status(405).end()

  const admin = await requireAdminUser(guard.payload)
  if (!admin.ok) return res.status(404).end()

  try {
    const data = await loadInsights()
    return res.status(200).json(data)
  } catch (error) {
    return handleApiError(res, error, 'admin_insights')
  }
}
