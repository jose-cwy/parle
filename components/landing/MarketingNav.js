import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BookHeart, BookOpen, LogOut, MessageCircle, X } from 'lucide-react'
import { ease, spring } from '../../lib/motion'

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <line x1="3" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function userInitial(user) {
  const email = user?.email || ''
  return email.charAt(0).toUpperCase() || '?'
}

function DrawerDivider() {
  return <div className="pss-nav-drawer__divider" role="separator" aria-hidden="true" />
}

function PrimaryMenuItem({ href, icon: Icon, label, onClick }) {
  return (
    <Link href={href} className="pss-nav-drawer__link pss-nav-drawer__link--primary" onClick={onClick}>
      <span className="pss-nav-drawer__icon" aria-hidden="true">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className="pss-nav-drawer__label">{label}</span>
    </Link>
  )
}

function SecondaryMenuItem({ href, label, onClick }) {
  return (
    <Link href={href} className="pss-nav-drawer__link pss-nav-drawer__link--secondary" onClick={onClick}>
      {label}
    </Link>
  )
}

export default function MarketingNav({ user = null, ready = true, onLogout }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const reduceMotion = useReducedMotion()
  const router = useRouter()
  const close = useCallback(() => setOpen(false), [])
  const isRegister = router.pathname === '/register'
  const isLogin = router.pathname === '/login'
  const homeHref = user ? '/dashboard' : '/'

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [router.asPath])

  useEffect(() => {
    if (open) {
      document.body.classList.add('body--nav-open')
    } else {
      document.body.classList.remove('body--nav-open')
    }
    return () => document.body.classList.remove('body--nav-open')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  async function handleLogout() {
    close()
    await onLogout?.()
  }

  const drawer = (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="pss-nav-drawer__scrim"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: ease.out }}
            onClick={close}
          />

          <motion.aside
            className="pss-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: '100%' }}
            transition={reduceMotion ? { duration: 0 } : { ...spring.modal, opacity: { duration: 0.18 } }}
          >
            <div className="pss-nav-drawer__header">
              <button type="button" className="pss-nav-drawer__close" onClick={close} aria-label="Close menu">
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <nav className="pss-nav-drawer__links" aria-label="Site">
              <PrimaryMenuItem href="/chat" icon={MessageCircle} label="Start talking" onClick={close} />
              <PrimaryMenuItem href="/quotes" icon={BookOpen} label="Quotes" onClick={close} />
              <PrimaryMenuItem href="/journal" icon={BookHeart} label="Journal" onClick={close} />

              {user ? (
                <div className="pss-nav-drawer__auth-user">
                  <span className="pss-nav-drawer__avatar" aria-hidden="true">
                    {userInitial(user)}
                  </span>
                  <button
                    type="button"
                    className="pss-nav-drawer__link pss-nav-drawer__link--auth pss-nav-drawer__link--signout"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} strokeWidth={1.75} aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="pss-nav-drawer__auth-inline">
                  {!isLogin ? (
                    <Link
                      href="/login"
                      className="pss-nav-drawer__link pss-nav-drawer__link--secondary"
                      onClick={close}
                    >
                      Log in
                    </Link>
                  ) : null}
                  {!isLogin && !isRegister ? (
                    <span className="pss-nav-drawer__auth-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {!isRegister ? (
                    <Link
                      href="/register"
                      className="pss-nav-drawer__link pss-nav-drawer__link--secondary"
                      onClick={close}
                    >
                      Sign up
                    </Link>
                  ) : null}
                </div>
              )}

              <DrawerDivider />

              <SecondaryMenuItem href="/terms" label="Terms & Conditions" onClick={close} />
              <SecondaryMenuItem href="/contact" label="Contact" onClick={close} />
            </nav>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )

  return (
    <nav className="pss-nav sticky top-0 z-40">
      <div className="pss-nav__inner">
        <Link href={homeHref} className="pss-nav-logo font-serif text-2xl">
          parlé
        </Link>

        <div className="pss-nav__actions">
          {ready && !user && !isRegister && (
            <>
              <Link href="/register" className="pss-nav-cta hidden sm:inline-flex">
                Start free
              </Link>
              {!isLogin && (
                <Link href="/login" className="pss-nav-cta pss-nav-cta--inverse hidden sm:inline-flex">
                  Log in
                </Link>
              )}
            </>
          )}
          {ready && user && (
            <Link href="/dashboard" className="pss-nav-link hidden sm:inline-flex">
              Dashboard
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="pss-nav__menu-btn"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <HamburgerIcon />
          </button>
        </div>
      </div>

      {mounted ? createPortal(drawer, document.body) : null}
    </nav>
  )
}
