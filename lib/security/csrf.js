function getAllowedOrigins() {
  const fromEnv = process.env.ALLOWED_ORIGINS || ''
  const configured = fromEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000']
  const appUrl = process.env.APP_URL ? [process.env.APP_URL.trim()] : []
  return [...new Set([...configured, ...appUrl, ...defaults])]
}

function originMatchesHost(origin, host) {
  if (!origin || !host) return false
  try {
    const url = new URL(origin)
    return url.host === host
  } catch {
    return false
  }
}

function assertSameOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || 'GET')) {
    return true
  }

  const origin = req.headers.origin
  const host = req.headers.host
  const allowed = getAllowedOrigins()

  if (origin) {
    if (allowed.includes(origin)) return true
    if (originMatchesHost(origin, host)) return true
    return false
  }

  const referer = req.headers.referer
  if (referer) {
    try {
      const ref = new URL(referer)
      if (allowed.some((o) => {
        try {
          return new URL(o).origin === ref.origin
        } catch {
          return false
        }
      })) {
        return true
      }
      if (host && ref.host === host) return true
    } catch {
      return false
    }
  }

  return process.env.NODE_ENV !== 'production'
}

function applyCors(req, res) {
  const origin = req.headers.origin
  const allowed = getAllowedOrigins()

  if (origin && (allowed.includes(origin) || originMatchesHost(origin, req.headers.host))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Today')
}

module.exports = {
  getAllowedOrigins,
  assertSameOrigin,
  applyCors,
}
