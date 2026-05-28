import { motion, useReducedMotion } from 'framer-motion'
import HeartLogo from '../landing/HeartLogo'

export default function LoadingMark({ size = 28, className = '' }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={`hs-loading-mark ${className}`.trim()}
      aria-hidden="true"
      animate={reduceMotion ? undefined : { opacity: [0.72, 1, 0.72], scale: [0.98, 1, 0.98] }}
      transition={reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <HeartLogo size={size} />
    </motion.div>
  )
}
