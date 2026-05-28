import { motion, useReducedMotion } from 'framer-motion'
import LoadingMark from './LoadingMark'
import { pickLoadingMessage } from './messages'

export default function LoadingShell({
  children,
  message,
  messageSeed,
  fullPage = false,
  className = '',
  labelledBy,
}) {
  const reduceMotion = useReducedMotion()
  const copy = message || pickLoadingMessage(messageSeed)

  return (
    <div
      className={`hs-loading-shell${fullPage ? ' hs-loading-shell--page' : ''} ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={labelledBy || copy}
    >
      <motion.div
        className="hs-loading-shell__header"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <LoadingMark />
        <p className="hs-loading-shell__message">{copy}</p>
      </motion.div>
      {children}
    </div>
  )
}
