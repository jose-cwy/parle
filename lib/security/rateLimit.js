const buckets = new Map()

function rateLimit(key, { limit = 60, windowMs = 60_000 } = {}) {
  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count += 1

  if (bucket.count > limit) {
    return false
  }

  return true
}

function firstHeaderIp(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const ip = value.split(',')[0].trim()
  return ip || null
}

function getClientIp(req) {
  return (
    firstHeaderIp(req.headers['x-vercel-forwarded-for']) ||
    firstHeaderIp(req.headers['x-real-ip']) ||
    firstHeaderIp(req.headers['x-forwarded-for']) ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

module.exports = {
  rateLimit,
  getClientIp,
}
