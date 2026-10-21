import { handleApiError } from '../../../../lib/security/pipeline'
import { guardAdminApi } from '../../../../lib/parle/adminGuard'
import { listUsers } from '../../../../lib/parle/adminMetrics'

export default async function handler(req, res) {
  const admin = await guardAdminApi(req, res)
  if (!admin) return
  if (req.method !== 'GET') return res.status(405).end()
  try {
    const data = await listUsers({
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    })
    return res.status(200).json(data)
  } catch (error) {
    return handleApiError(res, error, 'admin_users')
  }
}
