/** In-memory auth cache — avoids duplicate /api/auth/me calls during navigation. */

let cachedUser = undefined
let inflight = null

export function getCachedAuthUser() {
  return cachedUser === undefined ? null : cachedUser
}

export function isAuthCacheReady() {
  return cachedUser !== undefined
}

export function setCachedAuthUser(user) {
  cachedUser = user ?? null
}

export function clearAuthCache() {
  cachedUser = undefined
  inflight = null
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('parle_settings_cache')
    } catch {
      /* ignore */
    }
  }
}

export async function fetchAuthUser({ force = false } = {}) {
  if (!force && cachedUser !== undefined) {
    return cachedUser
  }

  if (!force && inflight) {
    return inflight
  }

  inflight = fetch('/api/auth/me')
    .then(async (res) => {
      if (!res.ok) return null
      const payload = await res.json()
      return payload?.user ?? null
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
    })

  const user = await inflight
  cachedUser = user
  return user
}
