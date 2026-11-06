const { runApiPipeline, handleApiError } = require('../../../lib/security/pipeline')
const { createConversation, listConversations } = require('../../../lib/parle/conversations')
const { publicGenerationSnapshot } = require('../../../lib/parle/v2GenerationControl')
const { assertV2WritesAllowed } = require('../../../lib/parle/v2Rollout')

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
      const conversations = await listConversations(guard.payload.id, {
        status: req.query?.status === 'archived' ? 'archived' : 'active',
      })
      return res.status(200).json({
        conversations,
        generation: await publicGenerationSnapshot(),
      })
    }
    if (req.method === 'POST') {
      await assertV2WritesAllowed()
      const conversation = await createConversation(guard.payload.id, {
        modeId: req.body?.modeId,
        origin: 'live',
      })
      return res.status(201).json({ conversation })
    }
    return res.status(405).end()
  } catch (error) {
    return sendRouteError(res, error, 'conversations_index')
  }
}

module.exports = handler
module.exports.default = handler
