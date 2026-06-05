import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { isAppRoute, isMarketingCreamRoute } from '../lib/routes'
import AnimatedHamburger from './landing/AnimatedHamburger'
import LandingMenuSheet from './landing/LandingMenuSheet'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isHome = router.pathname === '/'
  const useFigmaNav = isMarketingCreamRoute(router.pathname) || isHome

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
      .catch(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [router.asPath])

  useEffect(() => {
    setMenuOpen(false)
  }, [router.asPath])

  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('body--nav-open')
    } else {
      document.body.classList.remove('body--nav-open')
    }
    return () => document.body.classList.remove('body--nav-open')
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  if (isAppRoute(router.pathname)) return null

  async function handleLogout() {
    setMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
  }

  const homeHref = user ? '/dashboard' : '/'

  if (!useFigmaNav) {
    return (
      <header className="marketing-header marketing-header--cream sticky top-0 z-50 w-full px-4 md:px-6 py-3">
        <div className="container flex items-center justify-between gap-4">
          <Link href={homeHref} className="lf-navbar__wordmark lf-serif italic text-2xl">
            parlé
          </Link>
          <nav className="flex items-center gap-4" aria-label="Site">
            {ready && !user && (
              <>
                <Link href="/login" className="text-sm hover:opacity-80">Log in</Link>
                <Link href="/register" className="lf-btn-primary text-sm px-4 py-2">Sign up</Link>
              </>
            )}
            {ready && user && (
              <>
                <Link href="/dashboard" className="text-sm hover:opacity-80">Dashboard</Link>
                <button type="button" className="text-sm hover:opacity-80" onClick={handleLogout}>
                  Log out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
    )
  }

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className="lf-navbar"
      >
        <div className="lf-container flex items-center justify-between py-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-8"
          >
            <Link href={homeHref} className="lf-navbar__wordmark lf-serif italic">
              parlé
            </Link>
            {ready && !user && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Link href="/login" className="lf-navbar__login hidden md:inline">
                  Log in
                </Link>
              </motion.div>
            )}
          </motion.div>

          <div className="flex items-center gap-4">
            {ready && !user && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="hidden md:block"
              >
                <Link href="/register" className="lf-navbar__cta">
                  Start free
                </Link>
              </motion.div>
            )}
            <AnimatedHamburger
              isOpen={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            />
          </div>
        </div>
      </motion.header>

      {ready && (
        <LandingMenuSheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          user={user}
          onLogout={handleLogout}
        />
      )}
    </>
  )
}
