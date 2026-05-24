'use client'
import { motion } from 'framer-motion'

const ORBS = [
  {
    style: {
      position: 'absolute', borderRadius: '50%', filter: 'blur(80px)',
      mixBlendMode: 'screen', pointerEvents: 'none',
      width: '55%', height: '50%', left: '-5%', top: '-8%',
      background: 'radial-gradient(circle, rgba(45,212,191,0.28) 0%, transparent 70%)',
    },
    animate: { x: [0, 18, 0], y: [0, -14, 0], scale: [1, 1.05, 1] },
    transition: { duration: 14, repeat: Infinity, ease: 'easeInOut' },
  },
  {
    style: {
      position: 'absolute', borderRadius: '50%', filter: 'blur(70px)',
      mixBlendMode: 'screen', pointerEvents: 'none',
      width: '45%', height: '40%', right: '0%', top: '5%',
      background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
    },
    animate: { x: [0, -12, 0], y: [0, 16, 0], scale: [1, 1.08, 1] },
    transition: { duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 },
  },
  {
    style: {
      position: 'absolute', borderRadius: '50%', filter: 'blur(90px)',
      mixBlendMode: 'screen', pointerEvents: 'none',
      width: '40%', height: '35%', left: '28%', bottom: '0%',
      background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)',
    },
    animate: { x: [0, 10, 0], y: [0, -10, 0], scale: [1, 1.04, 1] },
    transition: { duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 6 },
  },
]

function seededRng(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return ((s >>> 0) / 0xffffffff)
  }
}

function buildStars(count = 28) {
  const rng = seededRng(0xc0a5741e)
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${rng() * 96 + 2}%`,
    top: `${rng() * 92 + 2}%`,
    size: rng() * 1.8 + 0.6,
    dur: `${rng() * 3 + 2}s`,
    delay: `${rng() * 4}s`,
    minOp: (rng() * 0.18 + 0.08).toFixed(2),
    maxOp: (rng() * 0.4 + 0.5).toFixed(2),
  }))
}

const STARS = buildStars(28)

export default function OceanNightBg() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        borderRadius: 'inherit',
        background: `
          radial-gradient(ellipse 70% 50% at 15% 10%, rgba(45,212,191,0.14) 0%, transparent 55%),
          radial-gradient(ellipse 55% 40% at 85% 20%, rgba(99,102,241,0.12) 0%, transparent 50%),
          linear-gradient(165deg, #040e22 0%, #020d1a 50%, #010810 100%)
        `,
        pointerEvents: 'none',
      }}
    >
      {/* Ambient orb blobs */}
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          style={orb.style}
          animate={orb.animate}
          transition={orb.transition}
        />
      ))}

      {/* CSS star field */}
      <div className="star-field">
        {STARS.map(star => (
          <span
            key={star.id}
            className="star"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              '--dur': star.dur,
              '--delay': star.delay,
              '--min-op': star.minOp,
              '--max-op': star.maxOp,
            }}
          />
        ))}
      </div>

      {/* Cinematic vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 38%, rgba(1,5,14,0.5) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
