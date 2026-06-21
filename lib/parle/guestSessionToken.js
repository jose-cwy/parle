const SESSION_TOKEN_KEY = 'parle_session_token'

let memoryFallbackToken = null

function createGuestToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function getGuestSessionToken() {
  if (typeof window === 'undefined') return null

  try {
    let token = sessionStorage.getItem(SESSION_TOKEN_KEY)
    if (!token) {
      token = createGuestToken()
      sessionStorage.setItem(SESSION_TOKEN_KEY, token)
    }
    memoryFallbackToken = token
    return token
  } catch {
    if (!memoryFallbackToken) {
      memoryFallbackToken = createGuestToken()
    }
    return memoryFallbackToken
  }
}

export function setGuestSessionToken(token) {
  if (typeof window === 'undefined') return
  const value = String(token || '').trim()
  if (!value) return
  memoryFallbackToken = value
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, value)
  } catch {
    /* keep in-memory fallback only */
  }
}
