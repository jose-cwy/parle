/** In-memory auth cache — avoids duplicate /api/auth/me calls during navigation. */

let cachedUser = undefined
let inflight = null
const listeners = new Set()

function notifyListeners() {
  const snapshot = cachedUser === undefined ? null : cachedUser
  listeners.forEach((listener) => {
    try {
      listener(snapshot)
    } catch {
      /* ignore */
    }
  })
}

export function getCachedAuthUser() {
  return cachedUser === undefined ? null : cachedUser
}

export function isAuthCacheReady() {
  return cachedUser !== undefined
}

export function setCachedAuthUser(user) {
  cachedUser = user ?? null
  notifyListeners()
}

export function clearAuthCache() {
  cachedUser = undefined
  inflight = null
  notifyListeners()
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('parle_settings_cache')
    } catch {
      /* ignore */
    }
  }
}

export function subscribeAuthUser(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function fetchAuthUser({ force = false } = {}) {
  if (!force && cachedUser !== undefined) {
    return cachedUser
  }

  if (!force && inflight) {
    return inflight
  }

  inflight = fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(async (res) => {
      if (res.status === 401 || res.status === 403) {
        cachedUser = null
        notifyListeners()
        return null
      }

      if (!res.ok) {
        // Do not cache failures — allow retry on next navigation.
        return undefined
      }

      const payload = await res.json().catch(() => null)
      const user = payload?.user ?? null
      cachedUser = user
      notifyListeners()
      return user
    })
    .catch(() => undefined)
    .finally(() => {
      inflight = null
    })

  const user = await inflight
  if (user === undefined) {
    return getCachedAuthUser()
  }
  return user
}
