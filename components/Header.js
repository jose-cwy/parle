import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { spring } from '../lib/motion'

const EXPO = [0.16, 1, 0.3, 1]

/* ─── Menu feature nodes — positions & metadata ──────────────── */
const MENU_NODES = [
  {
    href: '/chat',
    label: 'AI Chat',
    desc: 'Someone who always listens',
    badge: 'Most loved',
    highlight: true,
    x: 0.30, y: 0.40,  // fractional viewport coords
  },
  {
    href: '/letter-to-yourself',
    label: 'Letter',
    desc: 'Write what you cannot say out loud',
    x: 0.63, y: 0.30,
  },
  {
    href: '/diary',
    label: 'Diary',
    desc: 'A page for every day',
    x: 0.67, y: 0.60,
  },
  {
    href: '/quotes',
    label: 'Quotes',
    desc: 'Words that reach you',
    x: 0.27, y: 0.67,
  },
]

/* Edges as pairs of node indices — forms a closed loop + diagonal */
const MENU_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]]

/* ─── Constellation icon SVG ─────────────────────────────────── */
/*
 * 4 dots connected by 2 lines, arranged like a small star cluster.
 * Closed: lines visible, dots at rest positions.
 * Open:   lines fade out, outer dots drift outward.
 */
function ConstellationIcon({ isOpen }) {
  /* Dot positions — [cx, cy] in 24×24 viewBox */
  const closed = { d0: [5, 6], d1: [19, 9], d2: [8, 19], d3: [14, 13] }
  const open   = { d0: [3, 4], d1: [21, 7], d2: [6, 21], d3: [14, 13] }
  const pos = isOpen ? open : closed

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Connecting lines */}
      <motion.line
        x1={closed.d0[0]} y1={closed.d0[1]}
        x2={closed.d3[0]} y2={closed.d3[1]}
        stroke="var(--accent-teal)" strokeWidth="1"
        animate={{ opacity: isOpen ? 0 : 0.7 }}
        transition={{ duration: 0.22 }}
      />
      <motion.line
        x1={closed.d3[0]} y1={closed.d3[1]}
        x2={closed.d1[0]} y2={closed.d1[1]}
        stroke="var(--accent-teal)" strokeWidth="1"
        animate={{ opacity: isOpen ? 0 : 0.55 }}
        transition={{ duration: 0.22 }}
      />
      <motion.line
        x1={closed.d3[0]} y1={closed.d3[1]}
        x2={closed.d2[0]} y2={closed.d2[1]}
        stroke="var(--accent-teal)" strokeWidth="1"
        animate={{ opacity: isOpen ? 0 : 0.45 }}
        transition={{ duration: 0.22 }}
      />

      {/* Outer dot 0 */}
      <motion.circle
        animate={{ cx: pos.d0[0], cy: pos.d0[1] }}
        transition={{ duration: 0.28, ease: EXPO }}
        r={isOpen ? 1.8 : 2} fill="var(--accent-teal)"
        style={{ filter: 'drop-shadow(0 0 3px rgba(45,212,191,0.9))' }}
      />
      {/* Outer dot 1 */}
      <motion.circle
        animate={{ cx: pos.d1[0], cy: pos.d1[1] }}
        transition={{ duration: 0.28, ease: EXPO }}
        r={isOpen ? 1.8 : 1.6} fill="var(--accent-teal)"
        style={{ filter: 'drop-shadow(0 0 2px rgba(45,212,191,0.7))' }}
      />
      {/* Outer dot 2 */}
      <motion.circle
        animate={{ cx: pos.d2[0], cy: pos.d2[1] }}
        transition={{ duration: 0.28, ease: EXPO }}
        r={isOpen ? 1.8 : 1.4} fill="rgba(167,243,208,0.85)"
        style={{ filter: 'drop-shadow(0 0 2px rgba(45,212,191,0.6))' }}
      />
      {/* Center node — always visible, pulses when open */}
      <motion.circle
        cx={pos.d3[0]} cy={pos.d3[1]}
        animate={{ r: isOpen ? [2.5, 3.2, 2.5] : 2.5, opacity: isOpen ? [1, 0.7, 1] : 1 }}
        transition={{ duration: isOpen ? 1.6 : 0.2, repeat: isOpen ? Infinity : 0, ease: 'easeInOut' }}
        fill="var(--accent-teal)"
        style={{ filter: 'drop-shadow(0 0 4px rgba(45,212,191,1))' }}
      />
    </svg>
  )
}

/* ─── Constellation canvas inside the menu overlay ───────────── */
/*
 * Draws the connecting lines between node positions, animating
 * them sequentially like the OceanTrail (comet head drawing effect).
 */
function MenuConstellation({ isOpen, nodeRefs }) {
  const canvasRef  = useRef(null)
  const rafRef     = useRef(null)
  const startRef   = useRef(null)

  const DRAW_DURATION = 900 // ms to draw all edges

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width  = window.innerWidth  * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    if (!isOpen) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      return
    }

    startRef.current = null

    const draw = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const W = window.innerWidth
      const H = window.innerHeight

      ctx.clearRect(0, 0, W, H)

      /* Get node screen positions */
      const positions = MENU_NODES.map((n) => ({
        x: n.x * W,
        y: n.y * H,
      }))

      const totalEdges  = MENU_EDGES.length
      const perEdge     = DRAW_DURATION / totalEdges
      const globalT     = Math.min(elapsed / DRAW_DURATION, 1)

      for (let ei = 0; ei < totalEdges; ei++) {
        const edgeStart = ei * perEdge
        const edgeEnd   = edgeStart + perEdge
        if (elapsed < edgeStart) continue

        const [ai, bi]  = MENU_EDGES[ei]
        const ax = positions[ai].x, ay = positions[ai].y
        const bx = positions[bi].x, by = positions[bi].y
        const t = Math.min((elapsed - edgeStart) / perEdge, 1)

        /* Completed portion */
        const ex = ax + (bx - ax) * t
        const ey = ay + (by - ay) * t

        /* Line gradient */
        const grad = ctx.createLinearGradient(ax, ay, ex, ey)
        grad.addColorStop(0,   'rgba(45,212,191,0.08)')
        grad.addColorStop(0.6, 'rgba(56,189,248,0.45)')
        grad.addColorStop(1,   'rgba(167,243,208,0.85)')

        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ex, ey)
        ctx.strokeStyle = grad
        ctx.lineWidth   = 1.2
        ctx.shadowBlur  = 0
        ctx.stroke()

        /* Comet head at leading edge (only for currently-drawing edge) */
        if (t < 1) {
          ctx.beginPath()
          ctx.arc(ex, ey, 3, 0, Math.PI * 2)
          ctx.fillStyle   = 'rgba(200,255,245,0.95)'
          ctx.shadowBlur  = 12
          ctx.shadowColor = 'rgba(45,212,191,0.9)'
          ctx.fill()
          ctx.shadowBlur  = 0
        }
      }

      if (globalT < 1) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [isOpen])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}

/* ─── Main Header export ─────────────────────────────────────── */
export default function Header() {
  const [user, setUser]     = useState(null)
  const [ready, setReady]   = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()

  /* Close on route change */
  useEffect(() => {
    const close = () => setIsOpen(false)
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])

  /* Lock body scroll while menu open */
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
            aria-label="Heartstrings Club home"
          >
            <span
              className="inline-block w-2 h-2 rounded-full bg-[var(--accent-teal)]"
              style={{ boxShadow: '0 0 10px var(--accent-teal-glow)' }}
              aria-hidden="true"
            />
            Heartstrings Club
          </Link>

          {/* Constellation icon button */}
          <motion.button
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((v) => !v)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.15 }}
            style={{
              background: isOpen
                ? 'rgba(45,212,191,0.12)'
                : 'rgba(3,12,28,0.65)',
              border: `1px solid ${isOpen ? 'rgba(45,212,191,0.32)' : 'rgba(45,212,191,0.18)'}`,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '12px',
              padding: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              transition: 'background 0.22s, border-color 0.22s',
            }}
          >
            <ConstellationIcon isOpen={isOpen} />
          </motion.button>
        </div>
      </motion.header>

      {/* ── Full-screen constellation menu overlay ──────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: EXPO }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 45,
              background: 'rgba(2,9,20,0.88)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              overflow: 'hidden',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false) }}
          >
            {/* Canvas-drawn constellation lines */}
            <MenuConstellation isOpen={isOpen} />

            {/* Close button top-right */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.3, ease: EXPO }}
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(45,212,191,0.08)',
                border: '1px solid rgba(45,212,191,0.18)',
                borderRadius: '10px',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-soft)',
                fontSize: '1.2rem',
                zIndex: 2,
              }}
            >
              ×
            </motion.button>

            {/* Wordmark top-left */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35, ease: EXPO }}
              style={{
                position: 'absolute',
                top: '1.4rem',
                left: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                zIndex: 2,
              }}
            >
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--accent-teal)',
                  boxShadow: '0 0 10px var(--accent-teal-glow)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' }}>
                Heartstrings Club
              </span>
            </motion.div>

            {/* ── Star nodes ───────────────────────────────── */}
            {MENU_NODES.map((node, i) => (
              <motion.div
                key={node.href}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{
                  delay: 0.18 + i * 0.08,
                  duration: 0.45,
                  type: 'spring',
                  stiffness: 260,
                  damping: 22,
                }}
                style={{
                  position: 'absolute',
                  left: `${node.x * 100}%`,
                  top: `${node.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 2,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
                onClick={() => router.push(node.href)}
              >
                {/* Glowing star dot */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.6rem',
                    width: node.highlight ? 28 : 20,
                    height: node.highlight ? 28 : 20,
                  }}
                >
                  {/* Outer pulse ring */}
                  <motion.div
                    style={{
                      position: 'absolute',
                      inset: -6,
                      borderRadius: '50%',
                      border: `1px solid ${node.highlight ? 'rgba(45,212,191,0.5)' : 'rgba(167,243,208,0.3)'}`,
                    }}
                    animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: i * 0.3 }}
                  />
                  {/* Core dot */}
                  <div
                    style={{
                      width: node.highlight ? 16 : 10,
                      height: node.highlight ? 16 : 10,
                      borderRadius: '50%',
                      background: node.highlight
                        ? 'radial-gradient(circle, rgba(120,255,230,1) 0%, rgba(45,212,191,0.9) 60%)'
                        : 'radial-gradient(circle, rgba(200,240,255,0.95) 0%, rgba(100,200,220,0.7) 70%)',
                      boxShadow: node.highlight
                        ? '0 0 24px rgba(45,212,191,0.9), 0 0 48px rgba(45,212,191,0.4)'
                        : '0 0 12px rgba(167,243,208,0.7)',
                    }}
                  />
                </div>

                {/* Label */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <span
                    style={{
                      fontSize: node.highlight ? '1.1rem' : '0.9rem',
                      fontWeight: 700,
                      color: node.highlight ? 'rgba(120,255,230,0.96)' : 'rgba(200,235,255,0.92)',
                      letterSpacing: '-0.01em',
                      textShadow: node.highlight
                        ? '0 0 20px rgba(45,212,191,0.6)'
                        : '0 0 12px rgba(100,200,220,0.4)',
                    }}
                  >
                    {node.label}
                  </span>
                  {node.badge && (
                    <span
                      style={{
                        fontSize: '0.55rem',
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        background: 'rgba(45,212,191,0.16)',
                        color: 'var(--accent-teal)',
                        border: '1px solid rgba(45,212,191,0.3)',
                        borderRadius: '999px',
                        padding: '0.1em 0.5em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {node.badge}
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: '0.72rem',
                    color: 'rgba(150,200,220,0.65)',
                    margin: 0,
                    maxWidth: 130,
                    lineHeight: 1.4,
                    textAlign: 'center',
                  }}
                >
                  {node.desc}
                </p>
              </motion.div>
            ))}

            {/* ── Auth row — bottom center ─────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4, ease: EXPO }}
              style={{
                position: 'absolute',
                bottom: '2.5rem',
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                zIndex: 2,
              }}
            >
              {!ready && (
                <div style={{ height: 38, width: 120, background: 'rgba(45,212,191,0.07)', borderRadius: 10 }} />
              )}
              {ready && !user && (
                <>
                  <Link
                    href="/login"
                    onClick={() => setIsOpen(false)}
                    style={{
                      padding: '0.6rem 1.4rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(45,212,191,0.22)',
                      color: 'var(--text)',
                      textDecoration: 'none',
                      fontSize: '0.88rem',
                      fontWeight: 500,
                      background: 'rgba(3,12,28,0.5)',
                    }}
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsOpen(false)}
                    style={{
                      padding: '0.6rem 1.4rem',
                      borderRadius: '999px',
                      background: 'rgba(45,212,191,0.14)',
                      border: '1px solid rgba(45,212,191,0.35)',
                      color: 'var(--accent-teal)',
                      textDecoration: 'none',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                    }}
                  >
                    Sign up free
                  </Link>
                </>
              )}
              {ready && user && (
                <button
                  onClick={handleLogout}
                  style={{
                    padding: '0.6rem 1.4rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(45,212,191,0.18)',
                    background: 'transparent',
                    color: 'var(--text-soft)',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Log out
                </button>
              )}
            </motion.div>

            {/* Subtle tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.5 }}
              style={{
                position: 'absolute',
                bottom: '1rem',
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: '0.65rem',
                color: 'rgba(150,190,210,0.25)',
                letterSpacing: '0.08em',
                zIndex: 2,
              }}
            >
              A SAFE SPACE TO FEEL
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
