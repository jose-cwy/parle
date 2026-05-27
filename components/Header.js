import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { spring } from '../lib/motion'
import { isAppRoute, isLandingThemeRoute } from '../lib/routes'
import HeartMorphDrawer from './landing/HeartMorphDrawer'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isHome = router.pathname === '/'
  const landingTheme = isLandingThemeRoute(router.pathname)

  useEffect(() => {
    let active = true
    setReady(false)
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!active) return
        if (res.ok) {
          const payload = await res.json()
          setUser(payload.user || null)
        }
        setReady(true)
      })
      .catch(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [router.asPath])

  if (isAppRoute(router.pathname)) return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
  }

  const chatHref = user ? '/chat' : '/login?next=/chat'

  const headerClass = [
    'marketing-header',
    'sticky',
    'top-0',
    'z-40',
    'w-full',
    'px-4',
    'py-3',
    isHome ? 'marketing-header--home' : '',
    landingTheme && !isHome ? 'marketing-header--landing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <motion.header
      className={headerClass}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      <div className="container flex items-center justify-between gap-4">
        <Link
          href={user ? '/dashboard' : '/'}
          className="brand-mark text-lg font-semibold"
          style={isHome || landingTheme ? { color: 'var(--landing-text)' } : undefined}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full mr-2${isHome || landingTheme ? ' marketing-header__dot' : ''}`}
            style={
              isHome || landingTheme
                ? undefined
                : {
                    background: 'var(--accent-maroon)',
                    boxShadow: '0 0 10px var(--accent-maroon-glow)',
                  }
            }
            aria-hidden="true"
          />
          Heartstrings Club
        </Link>

        {isHome ? (
          <nav className="marketing-header__nav marketing-header__nav--landing" aria-label="Site">
            {ready && (
              <HeartMorphDrawer
                user={user}
                chatHref={chatHref}
                open={menuOpen}
                onOpenChange={setMenuOpen}
              />
            )}
          </nav>
        ) : (
          <nav className="marketing-header__nav" aria-label="Site">
            {!ready && <span className="marketing-header__placeholder" aria-hidden="true" />}
            {ready && user && (
              <>
                <Link href="/dashboard" className="marketing-header__link">Dashboard</Link>
                <button type="button" className="marketing-header__link marketing-header__btn" onClick={handleLogout}>
                  Log out
                </button>
              </>
            )}
            {ready && !user && (
              <>
                <Link href="/login" className="marketing-header__link">Log in</Link>
                <Link href="/register" className="marketing-header__cta">Sign up</Link>
              </>
            )}
          </nav>
        )}
      </div>
    </motion.header>
  )
}
