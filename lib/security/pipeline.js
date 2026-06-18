const { checkRateLimit, sendRateLimitResponse } = require('../rateLimiter')

function runApiPipeline(req, res, options = {}) {
  const { applyCors } = require('./csrf')
  const { getTokenFromReq, verifyToken } = require('../auth')
  const { assertSameOrigin } = require('./csrf')

  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return { ok: false, handled: true }
  }

  if (!assertSameOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return { ok: false, handled: true }
  }

  let payload = null
  const token = getTokenFromReq(req)
  if (token) {
    payload = verifyToken(token)
    if (payload?.id) {
      // authenticated
    } else if (options.requireAuth) {
      res.status(401).json({ error: 'Unauthorized' })
      return { ok: false, handled: true }
    }
  } else if (options.requireAuth) {
    res.status(401).json({ error: 'Unauthorized' })
    return { ok: false, handled: true }
  }

  const rate = checkRateLimit(req, {
    tier: options.tier,
    userId: payload?.id,
  })

  if (!rate.allowed) {
    sendRateLimitResponse(res, rate.cfg)
    return { ok: false, handled: true }
  }

  return { ok: true, payload, handled: false }
}

function handleApiError(res, error, context) {
  console.error(`${context}_error`, error)
  return res.status(500).json({ error: 'Something went wrong' })
}

module.exports = {
  runApiPipeline,
  handleApiError,
}
