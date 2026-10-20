function readProvidedCronSecret(req) {
  const header = String(req?.headers?.authorization || '')
  const bearer = header.replace(/^Bearer\s+/i, '').trim()
  if (bearer) return bearer
  const querySecret = req?.query?.secret
  if (querySecret != null && String(querySecret).trim()) return String(querySecret).trim()
  const bodySecret = req?.body?.secret
  if (bodySecret != null && String(bodySecret).trim()) return String(bodySecret).trim()
  return ''
}

function authorizeCron(req, env = process.env) {
  const secret = String(env?.CRON_SECRET || '').trim()
  if (!secret) {
    return {
      ok: false,
      status: 503,
      body: { error: 'Cron is not configured' },
    }
  }
  if (readProvidedCronSecret(req) !== secret) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized' },
    }
  }
  return { ok: true }
}

module.exports = {
  readProvidedCronSecret,
  authorizeCron,
}
