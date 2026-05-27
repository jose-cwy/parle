import { motion, useReducedMotion } from 'framer-motion'

const LINES = [
  'Not a feed.',
  'Not a fix.',
  'A room for what hurts.',
]

const EXPO = [0.16, 1, 0.3, 1]

/**
 * Manifesto beat — what Heartstrings is (phase 1).
 */
export default function ManifestoChapter({ visible }) {
  const reduceMotion = useReducedMotion()

  if (!visible) return null

  return (
    <motion.div
      className="manifesto-chapter"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
      transition={{ duration: 0.55, ease: EXPO }}
    >
      <p className="manifesto-chapter__eyebrow">What this is</p>
      {LINES.map((line, i) => (
        <motion.p
          key={line}
          className="manifesto-chapter__line"
          initial={reduceMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 + i * 0.12, duration: 0.65, ease: EXPO }}
        >
          {line}
        </motion.p>
      ))}
    </motion.div>
  )
}
