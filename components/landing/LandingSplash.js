import { motion, useReducedMotion } from 'framer-motion'

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
          <svg viewBox="0 0 32 32" className="h-11 w-11" fill="none">
            <path
              d="M16 25 C 7 19, 7 10, 13 10 C 16 10, 16 13, 16 13 C 16 13, 16 10, 19 10 C 25 10, 25 19, 16 25 Z"
              stroke="var(--hs-auth-red)"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 13 C 16 18, 22 21, 28 19"
              stroke="var(--hs-auth-red-deep)"
              strokeWidth="1"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
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
