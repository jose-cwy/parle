/**
 * Rate limit tier definitions for parlé API routes.
 * Uses the in-memory limiter in lib/security/rateLimit.js (Next.js API routes).
 */

const { rateLimit, getClientIp } = require('./security/rateLimit')

const TIERS = {
  authStrict: {
    limit: 10,
    windowMs: 15 * 60 * 1000,
    error: 'too_many_attempts',
    message: 'too many attempts. please wait.',
  },
  authRead: {
    limit: 120,
    windowMs: 60 * 1000,
    error: 'rate_limited',
    message: 'too many requests. please wait.',
  },
  guestChat: {
    limit: 10,
    windowMs: 60 * 1000,
    error: 'rate_limited',
    message: 'too many messages. take a breath.',
    retryAfter: 60,
  },
  userChat: {
    limit: 20,
    windowMs: 60 * 1000,
    error: 'rate_limited',
    message: 'too many messages. take a breath.',
    retryAfter: 60,
  },
  chatRead: {
    limit: 120,
    windowMs: 60 * 1000,
    error: 'rate_limited',
    message: 'too many requests. please wait.',
  },
  chat: {
    limit: 120,
    windowMs: 60 * 1000,
    error: 'rate_limited',
    message: 'too many requests. please wait.',
  },
  settings: {
    limit: 120,
    windowMs: 60 * 1000,
    error: 'rate_limited',
    message: 'too many requests. please wait.',
  },
  default: {
    limit: 60,
    windowMs: 60 * 1000,
    error: 'rate_limited',
    message: 'too many requests. please wait.',
  },
}

function resolveTier(pathname) {
  const path = String(pathname || '').split('?')[0]
  if (path === '/api/auth/login' || path === '/api/auth/register') return 'authStrict'
  if (path.startsWith('/api/auth')) return 'authRead'
  if (path === '/api/chat/guest-send') return 'guestChat'
  if (path === '/api/chat/send') return 'userChat'
  if (path.startsWith('/api/chat/')) return 'chatRead'
  if (path === '/api/user/settings' || path === '/api/user/parle-settings') return 'settings'
  return 'default'
}

function buildRateKey(tier, req, userId) {
  const ip = getClientIp(req)
  if (userId) return `${tier}:user:${userId}`
  return `${tier}:ip:${ip}`
}

function checkRateLimit(req, { tier: tierOverride, userId } = {}) {
  const path = (req.url || '').split('?')[0]
  const tierName = tierOverride || resolveTier(path)
  const cfg = TIERS[tierName] || TIERS.default
  const key = buildRateKey(tierName, req, userId)
  const allowed = rateLimit(key, { limit: cfg.limit, windowMs: cfg.windowMs })
  return { allowed, tierName, cfg }
}

function sendRateLimitResponse(res, cfg) {
  return res.status(429).json({
    error: cfg.error || 'rate_limited',
    message: cfg.message || 'too many requests. please wait.',
    ...(cfg.retryAfter ? { retryAfter: cfg.retryAfter } : {}),
  })
}

module.exports = {
  TIERS,
  resolveTier,
  buildRateKey,
  checkRateLimit,
  sendRateLimitResponse,
  getClientIp,
}
