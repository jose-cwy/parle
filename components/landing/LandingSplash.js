import { motion, useReducedMotion } from 'framer-motion'
import ParleMark from '../brand/ParleMark'

export default function LandingSplash({
  message = 'Preparing your quiet space…',
  statusLabel = 'Just a moment',
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="landing-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="landing-splash__inner">
        <div className="landing-splash__mark" aria-hidden>
          <ParleMark size="xl" />
        </div>

        <p className="landing-splash__eyebrow">parlé</p>
        <p className="landing-splash__message">
          {message.includes('quiet') ? (
            <>
              Preparing your <em>quiet space</em>…
            </>
          ) : (
            message
          )}
        </p>

        <div className="landing-splash__status">
          <div className="landing-splash__dots" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <span className="landing-splash__status-label">{statusLabel}</span>
        </div>
      </div>
    </motion.div>
  )
}
