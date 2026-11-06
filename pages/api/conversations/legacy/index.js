const { runApiPipeline, handleApiError } = require('../../../../lib/security/pipeline')
const { listLegacyWrap } = require('../../../../lib/parle/conversations')

function sendRouteError(res, error, context) {
  if (error?.statusCode) {
    return res.status(error.statusCode).json(error.body || { error: 'Error' })
  }
  return handleApiError(res, error, context)
}

async function handler(req, res) {
  try {
    const guard = await runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
    if (guard.handled) return
    if (req.method !== 'GET') return res.status(405).end()
    const payload = await listLegacyWrap(guard.payload.id)
    return res.status(200).json(payload)
  } catch (error) {
    return sendRouteError(res, error, 'conversations_legacy')
  }
}

module.exports = handler
module.exports.default = handler
