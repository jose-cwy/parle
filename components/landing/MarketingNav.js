import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  BookOpen,
  Heart,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
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

function MenuItem({ href, icon: Icon, label, onClick, asButton = false, buttonType = 'button' }) {
  const content = (
    <>
      <span className="pss-nav-drawer__icon" aria-hidden="true">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className="pss-nav-drawer__label">{label}</span>
    </>
  )

  if (asButton) {
    return (
      <button type={buttonType} className="pss-nav-drawer__link" onClick={onClick}>
        {content}
      </button>
    )
  }

  return (
    <Link href={href} className="pss-nav-drawer__link" onClick={onClick}>
      {content}
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
              <p className="pss-nav-drawer__eyebrow">Menu</p>
              <button type="button" className="pss-nav-drawer__close" onClick={close} aria-label="Close menu">
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <nav className="pss-nav-drawer__links" aria-label="Site">
              {!user ? (
                <>
                  <MenuItem href="/#what" icon={Heart} label="What is parlé" onClick={close} />
                  <MenuItem href="/#how" icon={Layers} label="How it works" onClick={close} />
                  <MenuItem href="/#voices" icon={Users} label="Voices" onClick={close} />
                  <MenuItem href="/chat" icon={MessageCircle} label="Start talking" onClick={close} />
                  <MenuItem href="/contact" icon={Mail} label="Contact" onClick={close} />
                  {!isLogin ? (
                    <MenuItem href="/login" icon={LogIn} label="Log in" onClick={close} />
                  ) : null}
                  {!isRegister ? (
                    <MenuItem href="/register" icon={UserPlus} label="Sign up" onClick={close} />
                  ) : null}
                </>
              ) : (
                <>
                  <MenuItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={close} />
                  <MenuItem href="/chat" icon={MessageCircle} label="Chat" onClick={close} />
                  <MenuItem href="/journal" icon={BookOpen} label="Journal" onClick={close} />
                  <MenuItem
                    asButton
                    icon={LogOut}
                    label="Log out"
                    onClick={handleLogout}
                  />
                </>
              )}
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
            <Link href="/register" className="pss-nav-cta hidden sm:inline-flex">
              Start free
            </Link>
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
