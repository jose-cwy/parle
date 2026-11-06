const { runApiPipeline, handleApiError } = require('../../../lib/security/pipeline')
const {
  getConversation,
  archiveConversation,
  restoreConversation,
} = require('../../../lib/parle/conversations')

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
    if (req.method === 'GET') {
      const payload = await getConversation(guard.payload.id, req.query.id, {
        cursor: req.query.cursor,
        limit: req.query.limit,
        version: req.query.v,
      })
      return res.status(200).json(payload)
    }
    if (req.method === 'PATCH') {
      const nextStatus = String(req.body?.status || '').trim()
      if (nextStatus === 'archived') {
        const conversation = await archiveConversation(guard.payload.id, req.query.id)
        return res.status(200).json({ conversation })
      }
      if (nextStatus === 'active') {
        const conversation = await restoreConversation(guard.payload.id, req.query.id)
        return res.status(200).json({ conversation })
      }
      return res.status(400).json({ error: 'invalid_status' })
    }
    return res.status(405).end()
  } catch (error) {
    return sendRouteError(res, error, 'conversations_get')
  }
}

module.exports = handler
module.exports.default = handler
