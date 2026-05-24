import { useMemo } from 'react'
import { motion } from 'framer-motion'

const SEED_PARTICLES = [
  { id: 0,  x: 12,  y: 18,  r: 2.5, color: '#ffb060', dur: 7.2,  delay: 0,    dy: -38, dx: 6  },
  { id: 1,  x: 28,  y: 62,  r: 3,   color: '#4A8A82', dur: 9.1,  delay: 1.1,  dy: -52, dx: -8 },
  { id: 2,  x: 55,  y: 34,  r: 2,   color: '#ffcc80', dur: 6.8,  delay: 2.4,  dy: -30, dx: 10 },
  { id: 3,  x: 72,  y: 75,  r: 3.5, color: '#ffb060', dur: 10.5, delay: 0.6,  dy: -60, dx: -5 },
  { id: 4,  x: 85,  y: 22,  r: 2,   color: '#7dd4b8', dur: 8.3,  delay: 3.2,  dy: -44, dx: 12 },
  { id: 5,  x: 7,   y: 50,  r: 2.5, color: '#ffd090', dur: 11.2, delay: 1.8,  dy: -55, dx: -9 },
  { id: 6,  x: 40,  y: 88,  r: 2,   color: '#ffb060', dur: 7.6,  delay: 4.0,  dy: -35, dx: 7  },
  { id: 7,  x: 62,  y: 10,  r: 3,   color: '#4A8A82', dur: 9.8,  delay: 0.3,  dy: -48, dx: -6 },
  { id: 8,  x: 18,  y: 40,  r: 2,   color: '#ffcc80', dur: 6.5,  delay: 2.8,  dy: -28, dx: 9  },
  { id: 9,  x: 48,  y: 68,  r: 3,   color: '#ffb060', dur: 10.1, delay: 1.5,  dy: -58, dx: -4 },
  { id: 10, x: 78,  y: 45,  r: 2.5, color: '#7dd4b8', dur: 8.7,  delay: 3.6,  dy: -42, dx: 11 },
  { id: 11, x: 92,  y: 80,  r: 2,   color: '#ffd090', dur: 7.9,  delay: 0.9,  dy: -36, dx: -7 },
  { id: 12, x: 33,  y: 15,  r: 3,   color: '#ffb060', dur: 11.6, delay: 2.1,  dy: -62, dx: 8  },
  { id: 13, x: 65,  y: 55,  r: 2.5, color: '#4A8A82', dur: 9.3,  delay: 4.4,  dy: -50, dx: -10},
  { id: 14, x: 20,  y: 82,  r: 2,   color: '#ffcc80', dur: 7.1,  delay: 1.3,  dy: -33, dx: 6  },
  { id: 15, x: 50,  y: 28,  r: 3.5, color: '#ffb060', dur: 8.9,  delay: 3.0,  dy: -46, dx: -5 },
  { id: 16, x: 80,  y: 70,  r: 2,   color: '#7dd4b8', dur: 6.4,  delay: 0.7,  dy: -31, dx: 9  },
  { id: 17, x: 10,  y: 92,  r: 3,   color: '#ffd090', dur: 10.8, delay: 2.6,  dy: -56, dx: -8 },
  { id: 18, x: 42,  y: 48,  r: 2.5, color: '#ffb060', dur: 9.5,  delay: 1.9,  dy: -43, dx: 7  },
  { id: 19, x: 70,  y: 36,  r: 2,   color: '#4A8A82', dur: 7.4,  delay: 3.8,  dy: -38, dx: -6 },
]

export default function FloatingParticles({ className = '' }) {
  return (
    <div
      className={`floating-particles ${className}`}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 8,
        overflow: 'hidden',
      }}
    >
      {SEED_PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.r * 2,
            height: p.r * 2,
            borderRadius: '50%',
            background: p.color,
            boxShadow: `0 0 ${p.r * 3}px ${p.r * 2}px ${p.color}88`,
          }}
          animate={{
            y: [0, p.dy * 0.4, p.dy, p.dy * 0.6, 0],
            x: [0, p.dx * 0.5, p.dx, p.dx * 0.3, 0],
            opacity: [0, 0.85, 0.6, 0.9, 0],
            scale: [0.5, 1.2, 0.9, 1.1, 0.5],
          }}
          transition={{
            duration: p.dur,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
