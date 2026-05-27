export const APP_ROUTES = [
  '/dashboard',
  '/chat',
  '/diary',
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

export function isLandingThemeRoute(pathname) {
  return LANDING_THEME_ROUTES.includes(pathname)
}

export function safeNextPath(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return '/dashboard'
  }
  return next
}
