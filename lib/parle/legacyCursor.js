const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function invalidCursor() {
  const error = new Error('invalid_cursor')
  error.statusCode = 400
  error.body = { error: 'invalid_cursor' }
  return error
}

function encodeLegacyCursor(createdAt, id, seq) {
  const t = new Date(createdAt).toISOString()
  const payload = JSON.stringify({
    t,
    i: String(id),
    s: Number(seq),
  })
  return Buffer.from(payload, 'utf8').toString('base64url')
}

function decodeLegacyCursor(raw) {
  if (raw == null || raw === '') return null
  const value = Array.isArray(raw) ? raw[0] : raw
  const text = String(value || '').trim()
  if (!text) return null
  if (text.length > 512) throw invalidCursor()
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'))
  } catch {
    throw invalidCursor()
  }
  if (!parsed || typeof parsed !== 'object') throw invalidCursor()
  const t = Date.parse(parsed.t)
  if (!Number.isFinite(t)) throw invalidCursor()
  if (!UUID_RE.test(String(parsed.i || ''))) throw invalidCursor()
  const seq = Number(parsed.s)
  if (!Number.isFinite(seq) || seq < 0) throw invalidCursor()
  return {
    createdAt: new Date(t).toISOString(),
    id: String(parsed.i),
    position: seq,
  }
}

function parseLegacyLimit(raw, { fallback = 50, max = 100 } = {}) {
  if (raw == null || raw === '') return fallback
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  if (!Number.isFinite(value) || value < 1) {
    const error = new Error('invalid_limit')
    error.statusCode = 400
    error.body = { error: 'invalid_limit' }
    throw error
  }
  return Math.min(max, Math.floor(value))
}

function parseTimelineVersion(raw) {
  if (raw == null || raw === '') return null
  const value = String(Array.isArray(raw) ? raw[0] : raw).trim()
  if (!value) return null
  if (value.length > 40) {
    const error = new Error('invalid_version')
    error.statusCode = 400
    error.body = { error: 'invalid_version' }
    throw error
  }
  if (/^\d+$/.test(value)) {
    const ms = Number(value)
    if (!Number.isFinite(ms)) {
      const error = new Error('invalid_version')
      error.statusCode = 400
      error.body = { error: 'invalid_version' }
      throw error
    }
    return String(ms)
  }
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) {
    const error = new Error('invalid_version')
    error.statusCode = 400
    error.body = { error: 'invalid_version' }
    throw error
  }
  return String(ms)
}

module.exports = {
  encodeLegacyCursor,
  decodeLegacyCursor,
  parseLegacyLimit,
  parseTimelineVersion,
}
