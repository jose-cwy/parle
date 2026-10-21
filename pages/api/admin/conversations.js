import { handleApiError } from '../../../lib/security/pipeline'
import { guardAdminApi } from '../../../lib/parle/adminGuard'
import { parseAdminRange, loadConversations } from '../../../lib/parle/adminMetrics'

export default async function handler(req, res) {
  const admin = await guardAdminApi(req, res)
  if (!admin) return
  if (req.method !== 'GET') return res.status(405).end()
  try {
    const range = parseAdminRange(req.query)
    const data = await loadConversations(range)
    return res.status(200).json({ range, ...data })
  } catch (error) {
    return handleApiError(res, error, 'admin_conversations')
  }
}
