const { runApiPipeline, handleApiError } = require('../../../lib/security/pipeline')
const { readLegacyWriteStatus } = require('../../../lib/parle/legacyWriteBarrier')

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const guard = await runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return

  try {
    const status = await readLegacyWriteStatus()
    return res.status(200).json({
      writable: status.writable,
      frozen: status.frozen,
      retryable: !status.writable,
      error: status.writable ? null : 'history_save_in_progress',
    })
  } catch (error) {
    return handleApiError(res, error, 'chat_write_status')
  }
}

module.exports = handler
module.exports.default = handler
