import { motion, useReducedMotion } from 'framer-motion'

const STATS = [
  { value: '0', label: 'feeds' },
  { value: '1', label: 'reader: you' },
  { value: '4', label: 'ways to let it out' },
]

const EXPO = [0.16, 1, 0.3, 1]

/**
 * Playful sanctuary stats — Untold personality, privacy-safe.
 */
export default function SanctuaryStats({ visible }) {
  const reduceMotion = useReducedMotion()

  if (!visible) return null

  return (
    <motion.div
      className="sanctuary-stats"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EXPO }}
      aria-label="About Heartstrings Club"
    >
      <ul className="sanctuary-stats__list">
        {STATS.map((stat, i) => (
          <motion.li
            key={stat.label}
            className="sanctuary-stats__item"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + i * 0.1, duration: 0.5, ease: EXPO }}
          >
            <span className="sanctuary-stats__value">{stat.value}</span>
            <span className="sanctuary-stats__label">{stat.label}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}
