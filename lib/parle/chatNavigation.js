import { isAppRoute } from '../routes'

export const CHAT_RETURN_PATH_KEY = 'parle-chat-return'

const CHAT_PREFIX = '/chat'

function normalizePath(path) {
  if (!path || typeof path !== 'string') return '/'
  const base = path.split('?')[0].split('#')[0] || '/'
  return base.startsWith('/') ? base : `/${base}`
}

export function isChatPath(path) {
  const normalized = normalizePath(path)
  return normalized === CHAT_PREFIX || normalized.startsWith(`${CHAT_PREFIX}/`)
}

export function rememberChatReturnPath(path) {
  if (typeof window === 'undefined') return
  const normalized = normalizePath(path)
  if (!normalized || isChatPath(normalized)) return
  sessionStorage.setItem(CHAT_RETURN_PATH_KEY, normalized)
}

export function rememberChatReturnFromReferrer() {
  if (typeof window === 'undefined') return
  if (sessionStorage.getItem(CHAT_RETURN_PATH_KEY)) return
  const ref = document.referrer
  if (!ref) return
  try {
    const url = new URL(ref)
    if (url.origin !== window.location.origin) return
    rememberChatReturnPath(url.pathname)
  } catch {
    // ignore malformed referrer
  }
}

export function getChatReturnPath(fallback = '/') {
  if (typeof window === 'undefined') return fallback
  const stored = sessionStorage.getItem(CHAT_RETURN_PATH_KEY)
  const normalized = normalizePath(stored)
  if (stored && !isChatPath(normalized)) return normalized
  return fallback
}

export function prefetchChatExitRoutes(router) {
  if (!router?.prefetch) return
  router.prefetch('/')
  router.prefetch('/login')
  router.prefetch('/register')
  const returnPath = getChatReturnPath('/')
  if (returnPath !== '/') router.prefetch(returnPath)
}

/** Leave chat via client router; hard-navigate when leaving the app shell. */
export function navigateAwayFromChat(router, path, { onNavigate } = {}) {
  const target = normalizePath(path)
  const destination = !target || isChatPath(target) ? '/' : target

  if (typeof window === 'undefined') {
    void router.push(destination)
    return
  }

  onNavigate?.()

  // Guests usually exit to /, /login, or /register — outside the app shell.
  // Next.js client transitions across layout branches often resolve as "failed"
  // without rejecting, which left guests stuck on /chat.
  if (!isAppRoute(destination)) {
    window.location.assign(destination)
    return
  }

  void router.push(destination).then((ok) => {
    if (ok === false) {
      window.location.assign(destination)
    }
  }).catch(() => {
    window.location.assign(destination)
  })
}
