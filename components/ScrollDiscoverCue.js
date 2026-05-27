import { motion, useReducedMotion } from 'framer-motion'

const CUE_BY_PHASE = [
  { max: 2, text: 'Scroll to discover' },
  { max: 3, text: 'Hold the star when ready' },
  { max: 8, text: 'Keep scrolling' },
]

function cueText(activePhase) {
  for (const row of CUE_BY_PHASE) {
    if (activePhase <= row.max) return row.text
  }
  return null
}

/**
 * Persistent bottom scroll cue — Untold-style discovery prompt.
 */
export default function ScrollDiscoverCue({ activePhase, visible = true }) {
  const reduceMotion = useReducedMotion()
  const text = cueText(activePhase)

  if (!visible || !text || activePhase >= 9) return null

  return (
    <motion.div
      className="scroll-discover-cue"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <span className="scroll-discover-cue__text">{text}</span>
      {!reduceMotion && (
        <motion.span
          className="scroll-discover-cue__line"
          aria-hidden="true"
          animate={{ scaleY: [0.2, 1, 0.2], opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </motion.div>
  )
}
