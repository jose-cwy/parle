const processingSessions = new Map()

const LOCK_TTL_MS = 5 * 60 * 1000

function sessionKey({ userId, sessionToken, ip }) {
  if (userId) return `user:${userId}`
  if (sessionToken) return `guest:${sessionToken}`
  return `ip:${ip || 'unknown'}`
}

function isProcessing(key) {
  const entry = processingSessions.get(key)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) {
    processingSessions.delete(key)
    return false
  }
  return true
}

function acquireProcessing(key) {
  if (isProcessing(key)) return false
  processingSessions.set(key, { expiresAt: Date.now() + LOCK_TTL_MS })
  return true
}

function releaseProcessing(key) {
  processingSessions.delete(key)
}

async function withProcessingLock(key, fn) {
  if (!acquireProcessing(key)) {
    return { locked: true }
  }
  try {
    const result = await fn()
    return { locked: false, result }
  } finally {
    releaseProcessing(key)
  }
}

module.exports = {
  sessionKey,
  isProcessing,
  acquireProcessing,
  releaseProcessing,
  withProcessingLock,
}
