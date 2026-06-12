const { getTokenFromReq, verifyToken } = require('../auth')
const { rateLimit, getClientIp } = require('./rateLimit')
const { assertSameOrigin, applyCors } = require('./csrf')

const TIERS = {
  auth: { limit: 10, windowMs: 60_000 },
  chat: { limit: 30, windowMs: 60_000 },
  default: { limit: 60, windowMs: 60_000 },
}

function resolveTier(req) {
  const path = (req.url || '').split('?')[0]
  if (path.startsWith('/api/auth')) return 'auth'
  if (
    path === '/api/chat/send' ||
    path === '/api/chat/guest-send' ||
    path.startsWith('/api/chat/')
  ) {
    return 'chat'
  }
  return 'default'
}

function runApiPipeline(req, res, options = {}) {
  applyCors(req, res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return { ok: false, handled: true }
  }

  if (!assertSameOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' })
    return { ok: false, handled: true }
  }

  const tier = options.tier || resolveTier(req)
  const cfg = TIERS[tier] || TIERS.default
  const ip = getClientIp(req)

  let rateKey = `${tier}:ip:${ip}`
  let payload = null

  const token = getTokenFromReq(req)
  if (token) {
    payload = verifyToken(token)
    if (payload?.id) {
      rateKey = `${tier}:user:${payload.id}`
    } else if (options.requireAuth) {
      res.status(401).json({ error: 'Unauthorized' })
      return { ok: false, handled: true }
    }
  } else if (options.requireAuth) {
    res.status(401).json({ error: 'Unauthorized' })
    return { ok: false, handled: true }
  }

  if (!rateLimit(rateKey, cfg)) {
    res.status(429).json({ error: 'Too many requests' })
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
