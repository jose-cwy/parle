import { motion, useReducedMotion } from 'framer-motion'
import { WHISPER_ANCHOR } from './MoonStoryScene'

/**
 * Clickable hit target aligned with the canvas whisper anchor.
 */
export default function WhisperStarTrigger({ visible, onLaunch, emphasized = false }) {
  const reduceMotion = useReducedMotion()

  if (!visible) return null

  return (
    <div
      className="whisper-star-trigger-wrap"
      style={{
        position: 'absolute',
        left: `${WHISPER_ANCHOR[0] * 100}%`,
        top: `${WHISPER_ANCHOR[1] * 100}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 29,
        pointerEvents: 'auto',
      }}
    >
      <motion.button
        type="button"
        className="whisper-star-trigger"
        aria-label="Release and begin your journey"
        onClick={onLaunch}
        whileHover={reduceMotion ? {} : { scale: 1.08 }}
        whileTap={reduceMotion ? {} : { scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        <span className="whisper-star-trigger__core" aria-hidden="true" />
        {!reduceMotion && (
          <span className="whisper-star-trigger__ring whisper-star-trigger__ring--a" aria-hidden="true" />
        )}
        {!reduceMotion && (
          <span className="whisper-star-trigger__ring whisper-star-trigger__ring--b" aria-hidden="true" />
        )}
      </motion.button>
      <p className={`whisper-star-trigger__hint${emphasized ? ' whisper-star-trigger__hint--emphasized' : ''}`}>
        Tap to let go
      </p>
    </div>
  )
}
