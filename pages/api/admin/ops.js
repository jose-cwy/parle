import { handleApiError } from '../../../lib/security/pipeline'
import { guardAdminApi } from '../../../lib/parle/adminGuard'
import { loadOps, loadAiStatus } from '../../../lib/parle/adminMetrics'

export default async function handler(req, res) {
  const admin = await guardAdminApi(req, res)
  if (!admin) return
  if (req.method !== 'GET') return res.status(405).end()
  try {
    const ops = await loadOps()
    return res.status(200).json({ ...ops, ai: loadAiStatus() })
  } catch (error) {
    return handleApiError(res, error, 'admin_ops')
  }
}
