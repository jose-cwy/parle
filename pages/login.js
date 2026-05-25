import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import AnimatedCard from '../components/AnimatedCard'
import Reveal from '../components/Reveal'
import SkeletonBlock, { SkeletonButton } from '../components/Skeleton'
import { hoverGlow } from '../lib/motion'

const EXPO = [0.16, 1, 0.3, 1]

/* ─── Constellation fly-through overlay ──────────────────────── */
/*
 * Plays a brief (~1.4s) star-field canvas animation before routing
 * a first-time user to the letter page. Stars accelerate toward the
 * viewer, then a bright flash fades out as we navigate.
 */
function ConstellationTransition({ active, onComplete }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const startRef  = useRef(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width  = window.innerWidth  * dpr
    canvas.height = window.innerHeight * dpr
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const W = window.innerWidth
    const H = window.innerHeight
    const cx = W / 2
    const cy = H / 2
    const DURATION = 1400  // ms

    /* Generate star field */
    const rng = (() => { let s = 0xabcd1234; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff } })()
    const stars = Array.from({ length: 140 }, () => ({
      x: (rng() * 2 - 1) * W * 0.7,
      y: (rng() * 2 - 1) * H * 0.7,
      z: rng() * 800 + 50,
      size: rng() * 1.5 + 0.4,
    }))

    startRef.current = null

    const draw = (ts) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const t = Math.min(elapsed / DURATION, 1)

      /* Accelerating camera: ease-in cubic */
      const camZ = 1200 * (t * t * t)
      const FOCAL = 500

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = `rgba(2,9,20,${1 - t * 0.3})`
      ctx.fillRect(0, 0, W, H)

      for (const s of stars) {
        const z = Math.max(s.z - camZ, 1)
        const scale = FOCAL / z
        const sx = s.x * scale + cx
        const sy = s.y * scale + cy
        if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue

        /* Streak length grows as star gets close */
        const streakT = Math.max(0, 1 - z / 180)
        const alpha   = Math.min(s.size * scale * 0.4, 1)

        if (streakT > 0.05) {
          const dx  = sx - cx, dy = sy - cy
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          const tailLen = s.size * scale * (1 + streakT * 20)
          const x0 = sx - (dx / len) * tailLen
          const y0 = sy - (dy / len) * tailLen
          const g = ctx.createLinearGradient(x0, y0, sx, sy)
          g.addColorStop(0, 'rgba(200,235,255,0)')
          g.addColorStop(1, `rgba(220,245,255,${alpha})`)
          ctx.strokeStyle = g
          ctx.lineWidth   = Math.max(s.size * scale * 0.5, 0.4)
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(sx, sy)
          ctx.stroke()
        } else {
          ctx.fillStyle = `rgba(210,240,255,${alpha})`
          ctx.beginPath()
          ctx.arc(sx, sy, Math.max(s.size * scale * 0.5, 0.3), 0, Math.PI * 2)
          ctx.fill()
        }
      }

      /* Bright flash at the end */
      if (t > 0.75) {
        const flashT = (t - 0.75) / 0.25
        ctx.fillStyle = `rgba(180,240,230,${flashT * 0.85})`
        ctx.fillRect(0, 0, W, H)
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(draw)
      } else {
        onComplete()
      }
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active, onComplete])

  if (!active) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#020912',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: EXPO }}
          style={{
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            fontSize: 'clamp(1.1rem, 3vw, 1.6rem)',
            color: 'rgba(180,240,230,0.88)',
            textShadow: '0 0 40px rgba(45,212,191,0.5)',
            textAlign: 'center',
            padding: '0 2rem',
          }}
        >
          Your journey begins here.
        </motion.p>
      </div>
    </motion.div>
  )
}

/* ─── Login page ─────────────────────────────────────────────── */
export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const router = useRouter()

  const handleTransitionComplete = () => {
    router.push('/letter-to-yourself?welcome=1')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (res.ok) {
      const data = await res.json().catch(() => ({ firstTime: false }))
      if (data.firstTime) {
        /* First-time user — play constellation fly-through then navigate */
        setTransitioning(true)
      } else {
        router.push('/')
      }
    } else {
      const payload = await res.json().catch(() => null)
      alert(payload?.error || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <>
      <ConstellationTransition
        active={transitioning}
        onComplete={handleTransitionComplete}
      />

      <div className="mx-auto max-w-md">
        <Reveal>
          <AnimatedCard className="auth-card p-0 overflow-hidden" hover={false}>
            <motion.div
              className="auth-card-glow"
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative border-b border-[var(--border)] bg-[rgba(3,12,28,0.82)] px-6 py-5 sketch-frame rounded-t-[22px]">
              <p className="eyebrow">Welcome back</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold">Log in</h2>
              <p className="mt-2 text-sm subtle">
                The door is still open. Continue your journal, chat, and quotes.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="relative space-y-4 p-6">
              <label className="block mb-2 text-sm">
                Email
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  type="email"
                  required
                />
              </label>
              <label className="block mb-2 text-sm">
                Password
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field"
                  type="password"
                  required
                />
              </label>
              {loading ? (
                <SkeletonButton className="h-11 w-full" />
              ) : (
                <motion.button
                  type="submit"
                  className="soft-button soft-button-primary w-full border-transparent"
                  {...hoverGlow}
                >
                  Log in
                </motion.button>
              )}
              <p className="text-sm subtle">Welcome back to your private space.</p>
            </form>
          </AnimatedCard>
        </Reveal>
      </div>
    </>
  )
}
