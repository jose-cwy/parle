import { NextResponse } from 'next/server'

const isDev = process.env.NODE_ENV !== 'production'

function buildContentSecurityPolicy() {
  const scriptSrc = ["'self'", "'unsafe-inline'"]
  const connectSrc = ["'self'", 'https:']

  // Next.js dev server (React Refresh / webpack) requires eval; HMR uses websockets.
  if (isDev) {
    scriptSrc.push("'unsafe-eval'")
    connectSrc.push('ws:', 'wss:')
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

function applySecurityHeaders(response) {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy())
  return response
}

export function middleware(request) {
  const response = NextResponse.next()
  applySecurityHeaders(response)

  if (request.method === 'OPTIONS' && request.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 204, headers: response.headers })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
