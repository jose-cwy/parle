const SESSION_TOKEN_KEY = 'parle_session_token'

export function getGuestSessionToken() {
  if (typeof window === 'undefined') return null
  try {
    let token = sessionStorage.getItem(SESSION_TOKEN_KEY)
    if (!token) {
      token =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
      sessionStorage.setItem(SESSION_TOKEN_KEY, token)
    }
    return token
  } catch {
    return null
  }
}
