import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

const HERO_SRC = '/images/landing/window-hero.png'

function useDustSpecs() {
  return useMemo(() => {
    // Deterministic “random” so SSR/CSR match.
    const pts = []
    let s = 1337
    const rand = () => {
      s = (s * 48271) % 0x7fffffff
      return s / 0x7fffffff
    }
    for (let i = 0; i < 14; i++) {
      pts.push({
        left: 28 + rand() * 54,
        top: 16 + rand() * 56,
        size: 1 + rand() * 2.2,
        opacity: 0.06 + rand() * 0.09,
        dur: 6 + rand() * 6,
        drift: 10 + rand() * 18,
        delay: rand() * 4,
      })
    }
    return pts
  }, [])
}

export default function WindowBreezeHero() {
  const reduceMotion = useReducedMotion()
  const dust = useDustSpecs()

  return (
    <div className="windowHero" aria-hidden="true">
      {/* Base artwork as a background layer (keeps composition unchanged). */}
      <div className="windowHero__base" />

      {/* Gentle warmth outside the window (subtle pulse). */}
      {!reduceMotion && (
        <motion.div
          className="windowHero__glow"
          animate={{ opacity: [0.18, 0.26, 0.18], scale: [1, 1.02, 1] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Isolated “open window panel” layer (same artwork, clipped) */}
      <motion.div
        className="windowHero__panel"
        style={{ transformOrigin: '56% 18%' }}
        animate={
          reduceMotion
            ? { rotateZ: 0, rotateY: 0 }
            : {
                rotateZ: [-1.4, 1.2, -1.4],
                rotateY: [-2.2, 2.0, -2.2],
              }
        }
        transition={reduceMotion ? undefined : { duration: 6.2, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      />

      {/* Dust motes in the light beam (extremely subtle). */}
      {!reduceMotion && (
        <div className="windowHero__dust">
          {dust.map((p, idx) => (
            <motion.i
              // eslint-disable-next-line react/no-array-index-key
              key={idx}
              className="windowHero__mote"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: p.opacity,
              }}
              animate={{ y: [-p.drift * 0.45, p.drift * 0.55], x: [-p.drift * 0.12, p.drift * 0.12], opacity: [p.opacity, p.opacity * 1.35, p.opacity] }}
              transition={{ duration: p.dur, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: p.delay }}
            />
          ))}
        </div>
      )}

      {/* Provide the image url to all layers via CSS var */}
      <style jsx>{`
        .windowHero {
          --hero-img: url(${HERO_SRC});
        }
      `}</style>
    </div>
  )
}

