import { useMemo } from 'react'
import { motion, useTransform } from 'framer-motion'

/* ─── Star data — seeded so it's stable across re-renders ─── */
const STAR_COUNT = 42
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const STARS = (() => {
  const rand = seededRandom(0xbeef1234)
  return Array.from({ length: STAR_COUNT }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 65,        // stars cluster in upper ~65% of sky
    size: 1 + rand() * 2.5,
    dur:  2 + rand() * 4,
    delay: rand() * 4,
    minOp: 0.1 + rand() * 0.2,
    maxOp: 0.55 + rand() * 0.45,
  }))
})()

/* ─── Orb data — two slow-breathing ambient light blobs ──── */
const ORBS = [
  {
    id: 'teal',
    x: '18%', y: '28%',
    width: '42rem', height: '32rem',
    bg: 'radial-gradient(ellipse, rgba(45,212,191,0.28) 0%, transparent 70%)',
    dur: 9,
    delay: 0,
  },
  {
    id: 'indigo',
    x: '55%', y: '12%',
    width: '38rem', height: '28rem',
    bg: 'radial-gradient(ellipse, rgba(99,102,241,0.22) 0%, transparent 70%)',
    dur: 12,
    delay: -4,
  },
  {
    id: 'deep-teal',
    x: '72%', y: '45%',
    width: '28rem', height: '22rem',
    bg: 'radial-gradient(ellipse, rgba(56,189,248,0.16) 0%, transparent 70%)',
    dur: 7,
    delay: -2,
  },
]

/* ─── Window glow — warm amber light source (center-right) ── */
function WindowGlow({ scrollProgress }) {
  const opacity = useTransform(scrollProgress, [0, 0.3, 0.7, 1], [0.45, 0.7, 0.55, 0.35])
  const scale   = useTransform(scrollProgress, [0, 0.5, 1], [1, 1.12, 0.92])

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'absolute',
        right: '10%',
        top: '8%',
        width: '32rem',
        height: '28rem',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(250, 200, 120, 0.38) 0%, rgba(255,160,60,0.12) 45%, transparent 72%)',
        filter: 'blur(48px)',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity,
        scale,
        transformOrigin: 'center',
      }}
    />
  )
}

/* ─── Parallax depth shift on the whole scene ─────────────── */
function SceneParallax({ scrollProgress, children }) {
  const y = useTransform(scrollProgress, [0, 1], ['0%', '-8%'])
  return (
    <motion.div
      style={{ position: 'absolute', inset: '-8% -4% 0 -4%', y, willChange: 'transform' }}
    >
      {children}
    </motion.div>
  )
}

/* ─── Main exported component ────────────────────────────── */
export default function RoomScene({ scrollProgress }) {
  /* fog thins as user scrolls in */
  const fogOpacity = useTransform(scrollProgress, [0, 0.2, 0.55], [0.7, 0.3, 0.0])

  const stars = useMemo(() => STARS, [])

  return (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#020d1a' }}
      aria-hidden="true"
    >
      {/* ── Layer 1: Base deep gradient ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 120% 80% at 50% 100%, #060e24 0%, #020d1a 55%, #010810 100%)
          `,
        }}
      />

      {/* ── Layer 2: Ambient orbs — mix-blend-mode screen ── */}
      {ORBS.map((orb) => (
        <motion.div
          key={orb.id}
          className="night-orb"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.width,
            height: orb.height,
            background: orb.bg,
            mixBlendMode: 'screen',
          }}
          animate={{ opacity: [0.55, 1, 0.6, 1, 0.55], scale: [1, 1.06, 0.96, 1.04, 1] }}
          transition={{
            duration: orb.dur,
            repeat: Infinity,
            ease: [0.45, 0, 0.2, 1],
            delay: orb.delay,
          }}
        />
      ))}

      {/* ── Layer 3: Star field — zero JS cost, CSS @keyframes twinkle ── */}
      <SceneParallax scrollProgress={scrollProgress}>
        <div className="star-field">
          {stars.map((s) => (
            <span
              key={s.id}
              className="star"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
                '--dur': `${s.dur}s`,
                '--delay': `${s.delay}s`,
                '--min-op': s.minOp,
                '--max-op': s.maxOp,
              }}
            />
          ))}
        </div>
      </SceneParallax>

      {/* ── Layer 4: Window glow (warm amber top-right) ── */}
      <WindowGlow scrollProgress={scrollProgress} />

      {/* ── Layer 5: Horizon gradient — ground the scene ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            linear-gradient(
              to top,
              rgba(2,8,20,0.85) 0%,
              rgba(3,12,26,0.6) 18%,
              transparent 48%
            )
          `,
          pointerEvents: 'none',
        }}
      />

      {/* ── Layer 6: Shallow horizontal aurora band ── */}
      <motion.div
        style={{
          position: 'absolute',
          left: '-10%',
          right: '-10%',
          top: '28%',
          height: '14rem',
          background: `
            linear-gradient(
              to right,
              transparent 0%,
              rgba(45,212,191,0.08) 28%,
              rgba(56,189,248,0.10) 52%,
              rgba(99,102,241,0.07) 75%,
              transparent 100%
            )
          `,
          filter: 'blur(28px)',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
        animate={{ opacity: [0.5, 0.9, 0.6, 1, 0.5], scaleY: [1, 1.08, 0.95, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
      />

      {/* ── Layer 7: Entry fog — dissipates on scroll ── */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 70% at 50% 50%, rgba(2,8,20,0.45) 0%, rgba(1,5,15,0.88) 100%)
          `,
          opacity: fogOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* ── Layer 8: Cinematic vignette — permanent dark frame ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 85% 78% at 50% 50%, transparent 38%, rgba(1,5,15,0.72) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Layer 9: Subtle film grain ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          backgroundImage: `
            radial-gradient(rgba(255,255,255,0.9) 0.4px, transparent 0.4px),
            radial-gradient(rgba(45,212,191,0.35) 0.3px, transparent 0.3px)
          `,
          backgroundSize: '5px 5px, 9px 9px',
          backgroundPosition: '0 0, 2px 3px',
          pointerEvents: 'none',
          animation: 'grainShift 6s steps(4) infinite',
        }}
      />
    </div>
  )
}
