export const APP_ROUTES = [
  '/dashboard',
  '/chat',
  '/journal',
  '/quotes',
  '/letter-to-yourself',
]

export const FULL_BLEED_ROUTES = ['/']

export function isAppRoute(pathname) {
  return APP_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

export function isFullBleedRoute(pathname) {
  return FULL_BLEED_ROUTES.includes(pathname)
}

export function isMarketingRoute(pathname) {
  return isFullBleedRoute(pathname) || pathname === '/login' || pathname === '/register' || pathname === '/terms'
}

export const LANDING_THEME_ROUTES = ['/login', '/register']

/** Cream Haven shell — home, login, register */
export const MARKETING_CREAM_ROUTES = ['/', '/login', '/register', '/explore']

export function isLandingThemeRoute(pathname) {
  return LANDING_THEME_ROUTES.includes(pathname)
}

export function isMarketingCreamRoute(pathname) {
  return MARKETING_CREAM_ROUTES.includes(pathname)
}

const BLOCKED_NEXT_PATHS = new Set(['/login', '/register', '/terms'])

export function safeNextPath(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return '/dashboard'
  }

  const pathOnly = next.split('?')[0]
  if (BLOCKED_NEXT_PATHS.has(pathOnly)) {
    return '/dashboard'
  }

  return next
}
