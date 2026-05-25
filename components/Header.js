import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { spring } from '../lib/motion'

/* ─── Feature nav items shown in the side drawer ─────────────── */
const NAV_FEATURES = [
  {
    href: '/chat',
    label: 'AI Chat',
    desc: 'Talk it out with someone who always listens',
    icon: '💬',
    highlight: true,
    badge: 'Most loved',
  },
  {
    href: '/letter-to-yourself',
    label: 'Letter to Yourself',
    desc: 'Write what you cannot say out loud',
    icon: '✉️',
    highlight: false,
  },
  {
    href: '/diary',
    label: 'Private Diary',
    desc: 'A page for every day, just for you',
    icon: '📖',
    highlight: false,
  },
  {
    href: '/quotes',
    label: 'Healing Quotes',
    desc: 'Words that reach you when you need them',
    icon: '✦',
    highlight: false,
  },
]

/* ─── Easing ─────────────────────────────────────────────────── */
const EXPO = [0.16, 1, 0.3, 1]

export default function Header() {
  const [user, setUser]     = useState(null)
  const [ready, setReady]   = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  /* Close drawer on route change */
  useEffect(() => {
    const handleChange = () => setIsOpen(false)
    router.events.on('routeChangeStart', handleChange)
    return () => router.events.off('routeChangeStart', handleChange)
  }, [router.events])

  /* Prevent body scroll while drawer open */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  /* Auth state */
  useEffect(() => {
    setReady(false)
    let active = true
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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setIsOpen(false)
    router.push('/')
  }

  return (
    <>
      {/* ── Floating header bar ─────────────────────────────── */}
      <motion.header
        className="sticky top-0 z-40 w-full px-4 py-3 pointer-events-none"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
      >
        <div className="container flex items-center justify-between pointer-events-auto">
          {/* Logo */}
          <Link
            href="/"
            className="brand-mark text-xl font-semibold text-[var(--text)] cursor-pointer flex items-center gap-2"
            aria-label="Heartstrings Club"
          >
            <span
              className="inline-block w-2 h-2 rounded-full bg-[var(--accent-teal)]"
              style={{ boxShadow: '0 0 10px var(--accent-teal-glow)' }}
              aria-hidden="true"
            />
            Heartstrings Club
          </Link>

          {/* Hamburger button */}
          <button
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((v) => !v)}
            style={{
              background: 'rgba(3,12,28,0.65)',
              border: '1px solid rgba(45,212,191,0.18)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '10px',
              padding: '10px 12px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
            }}
          >
            {/* Three bars that animate into × */}
            <motion.span
              animate={isOpen
                ? { rotate: 45, y: 7, opacity: 1 }
                : { rotate: 0,  y: 0, opacity: 1 }
              }
              transition={{ duration: 0.25, ease: EXPO }}
              style={{
                display: 'block',
                width: 20,
                height: 1.5,
                background: 'var(--text)',
                borderRadius: 2,
                transformOrigin: 'center',
              }}
            />
            <motion.span
              animate={isOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.18, ease: EXPO }}
              style={{
                display: 'block',
                width: 20,
                height: 1.5,
                background: 'var(--text)',
                borderRadius: 2,
              }}
            />
            <motion.span
              animate={isOpen
                ? { rotate: -45, y: -7, opacity: 1 }
                : { rotate: 0,   y: 0,  opacity: 1 }
              }
              transition={{ duration: 0.25, ease: EXPO }}
              style={{
                display: 'block',
                width: 20,
                height: 1.5,
                background: 'var(--text)',
                borderRadius: 2,
                transformOrigin: 'center',
              }}
            />
          </button>
        </div>
      </motion.header>

      {/* ── Side drawer + backdrop ───────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              onClick={() => setIsOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 49,
                background: 'rgba(1,6,16,0.72)',
                backdropFilter: 'blur(3px)',
                WebkitBackdropFilter: 'blur(3px)',
              }}
            />

            {/* Drawer panel */}
            <motion.aside
              key="drawer-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 36, mass: 1 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
                width: 'min(340px, 90vw)',
                background: 'rgba(3,12,28,0.92)',
                borderLeft: '1px solid rgba(45,212,191,0.14)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem',
                overflowY: 'auto',
                gap: '0',
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              {/* Drawer header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--accent-teal)',
                      boxShadow: '0 0 10px var(--accent-teal-glow)',
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)' }}>
                    Heartstrings Club
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close menu"
                  style={{
                    background: 'rgba(45,212,191,0.08)',
                    border: '1px solid rgba(45,212,191,0.15)',
                    borderRadius: '8px',
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-soft)',
                    fontSize: '1.1rem',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Section label */}
              <p style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.75rem', fontWeight: 600 }}>
                Features
              </p>

              {/* Feature links */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {NAV_FEATURES.map((item, i) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + i * 0.055, duration: 0.38, ease: EXPO }}
                  >
                    <Link
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        background: item.highlight
                          ? 'rgba(45,212,191,0.08)'
                          : 'transparent',
                        border: item.highlight
                          ? '1px solid rgba(45,212,191,0.18)'
                          : '1px solid transparent',
                        transition: 'background 0.18s, border-color 0.18s',
                      }}
                    >
                      <span style={{ fontSize: '1.25rem', flexShrink: 0, width: 28, textAlign: 'center' }}>
                        {item.icon}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: item.highlight ? 'var(--accent-teal)' : 'var(--text)',
                          fontWeight: 600,
                          fontSize: '0.93rem',
                          marginBottom: '0.18rem',
                        }}>
                          {item.label}
                          {item.badge && (
                            <span style={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              background: 'rgba(45,212,191,0.18)',
                              color: 'var(--accent-teal)',
                              border: '1px solid rgba(45,212,191,0.3)',
                              borderRadius: '999px',
                              padding: '0.1em 0.55em',
                            }}>
                              {item.badge}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                          {item.desc}
                        </span>
                      </span>
                      <span style={{ color: 'var(--muted)', fontSize: '0.8rem', flexShrink: 0 }}>→</span>
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(45,212,191,0.1)', margin: '1.5rem 0' }} />

              {/* Auth section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32, duration: 0.38, ease: EXPO }}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
              >
                {!ready && (
                  <div style={{ height: 40, background: 'rgba(45,212,191,0.07)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
                )}
                {ready && !user && (
                  <>
                    <Link
                      href="/login"
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(45,212,191,0.22)',
                        color: 'var(--text)',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      Log in
                    </Link>
                    <Link
                      href="/register"
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        background: 'rgba(45,212,191,0.15)',
                        border: '1px solid rgba(45,212,191,0.35)',
                        color: 'var(--accent-teal)',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                      }}
                    >
                      Sign up — it&apos;s free
                    </Link>
                  </>
                )}
                {ready && user && (
                  <>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                      Signed in as <strong style={{ color: 'var(--text-soft)' }}>{user.email || user.username}</strong>
                    </p>
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'center',
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(45,212,191,0.18)',
                        background: 'transparent',
                        color: 'var(--text-soft)',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Log out
                    </button>
                  </>
                )}
              </motion.div>

              {/* Spacer to push footer to bottom */}
              <div style={{ flex: 1 }} />

              {/* Drawer footer */}
              <p style={{ fontSize: '0.7rem', color: 'rgba(180,210,220,0.28)', textAlign: 'center', marginTop: '1.5rem' }}>
                A safe space to feel.
              </p>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
