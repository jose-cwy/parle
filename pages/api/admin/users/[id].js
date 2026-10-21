import { handleApiError } from '../../../../lib/security/pipeline'
import { guardAdminApi } from '../../../../lib/parle/adminGuard'
import { isUuid } from '../../../../lib/parle/adminPage'
import { getUserUsage } from '../../../../lib/parle/adminMetrics'

export default async function handler(req, res) {
  const admin = await guardAdminApi(req, res)
  if (!admin) return
  if (req.method !== 'GET') return res.status(405).end()
  if (!isUuid(req.query.id)) return res.status(404).end()
  try {
    const data = await getUserUsage(req.query.id)
    if (!data.user) return res.status(404).end()
    return res.status(200).json(data)
  } catch (error) {
    return handleApiError(res, error, 'admin_user_detail')
  }
}
