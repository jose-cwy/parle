import { hasPreferredName } from './user.js'

export const APP_ROUTES = [
  '/dashboard',
  '/chat',
  '/journal',
  '/quotes',
]

export const ADMIN_HOME_PATH = '/admin'

export const FULL_BLEED_ROUTES = ['/']

export function isAppRoute(pathname) {
  return APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

export function isAdminRoute(pathname) {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

export const PROTECTED_APP_ROUTES = ['/dashboard', '/journal', '/quotes']

export function isChatRoute(pathname) {
  return pathname === '/chat' || pathname.startsWith('/chat/')
}

export function isProtectedAppRoute(pathname) {
  return PROTECTED_APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

export function isFullBleedRoute(pathname) {
  return FULL_BLEED_ROUTES.includes(pathname)
}

export function isMarketingRoute(pathname) {
  return (
    isFullBleedRoute(pathname)
    || pathname === '/login'
    || pathname === '/register'
    || pathname === '/terms'
    || pathname === '/contact'
  )
}

/** Standalone pages using parlé landing shell (nav + cream theme) */
export const PARLER_MARKETING_PAGES = ['/terms', '/contact']

export function isParlerMarketingPage(pathname) {
  return PARLER_MARKETING_PAGES.includes(pathname)
}

export const LANDING_THEME_ROUTES = ['/login', '/register', '/welcome']

/** Cream Haven shell — home, login, register */
export const MARKETING_CREAM_ROUTES = ['/', '/login', '/register', '/welcome', '/explore']

export function isLandingThemeRoute(pathname) {
  return LANDING_THEME_ROUTES.includes(pathname)
}

export function isMarketingCreamRoute(pathname) {
  return MARKETING_CREAM_ROUTES.includes(pathname)
}

const BLOCKED_NEXT_PATHS = new Set(['/login', '/register', '/welcome', '/terms'])

export function safeNextPath(next, fallback = '/dashboard') {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return fallback
  }

  const pathOnly = next.split('?')[0]
  if (BLOCKED_NEXT_PATHS.has(pathOnly)) {
    return fallback
  }

  return next
}

export function postLoginPath(user, next) {
  if (!hasPreferredName(user)) return '/welcome'
  const raw = Array.isArray(next) ? next[0] : next
  if (typeof raw === 'string' && raw.length > 0) {
    const fallback = user?.isAdmin === true ? ADMIN_HOME_PATH : '/dashboard'
    return safeNextPath(raw, fallback)
  }
  if (user?.isAdmin === true) return ADMIN_HOME_PATH
  return '/dashboard'
}

export function shouldShowInsightsNav(user) {
  return user?.isAdmin === true
}
