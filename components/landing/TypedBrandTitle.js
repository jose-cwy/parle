import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

function splitGraphemes(str) {
  return Array.from(str)
}

/**
 * Typewriter title — starts when `active` becomes true (e.g. after sun sets on scroll).
 */
export default function TypedBrandTitle({ id, active = false, startDelayMs = 0 }) {
  const reduceMotion = useReducedMotion()
  const text = 'Heartstrings Club'
  const letters = useMemo(() => splitGraphemes(text), [text])
  const [count, setCount] = useState(reduceMotion ? letters.length : 0)

  useEffect(() => {
    if (reduceMotion) {
      setCount(letters.length)
      return
    }
    if (!active) {
      setCount(0)
      return
    }

    let t0 = null
    let raf = 0
    let i = 0

    const tick = (ts) => {
      if (t0 == null) t0 = ts
      const elapsed = ts - t0
      if (elapsed < startDelayMs) {
        raf = requestAnimationFrame(tick)
        return
      }

      const target = Math.min(letters.length, Math.floor((elapsed - startDelayMs) / 58))
      if (target !== i) {
        i = target
        setCount(i)
      }
      if (i < letters.length) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [letters.length, reduceMotion, startDelayMs, active])

  if (reduceMotion) {
    return (
      <h1 id={id} className="typedBrandTitle" aria-label={text}>
        {text}
      </h1>
    )
  }

  return (
    <h1 id={id} className="typedBrandTitle" aria-label={text}>
      {letters.map((ch, idx) => {
        const shown = idx < count
        const isSpace = ch === ' '
        return (
          <motion.span
            key={`${ch}-${idx}`}
            className={`typedBrandTitle__ch${isSpace ? ' typedBrandTitle__ch--space' : ''}`}
            aria-hidden="true"
            initial={false}
            animate={{
              opacity: shown ? 1 : 0,
              y: shown ? 0 : 8,
              filter: shown ? 'blur(0px)' : 'blur(8px)',
            }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {ch}
          </motion.span>
        )
      })}
      {active && count < letters.length && (
        <motion.span
          className="typedBrandTitle__caret"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </h1>
  )
}
