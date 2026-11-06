import { handleApiError } from '../../../../lib/security/pipeline'
import { guardAdminApi } from '../../../../lib/parle/adminGuard'
import {
  isOpsControlExposed,
  loadGenerationControl,
  setGenerationControl,
} from '../../../../lib/parle/v2GenerationControl'

export default async function handler(req, res) {
  const admin = await guardAdminApi(req, res)
  if (!admin) return
  if (!isOpsControlExposed()) {
    return res.status(404).end()
  }
  try {
    if (req.method === 'GET') {
      const state = await loadGenerationControl({ force: true })
      return res.status(200).json(state)
    }
    if (req.method === 'POST') {
      const state = await setGenerationControl({
        actorId: admin.user.id,
        value: req.body?.value,
        confirm: req.body?.confirm,
        reason: req.body?.reason,
        expectedRevision: req.body?.expectedRevision,
      })
      return res.status(200).json(state)
    }
    return res.status(405).end()
  } catch (error) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json(error.body || { error: 'Error' })
    }
    return handleApiError(res, error, 'admin_v2_generation')
  }
}
