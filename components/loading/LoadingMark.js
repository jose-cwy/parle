import { motion, useReducedMotion } from 'framer-motion'
import ParleMark from '../brand/ParleMark'

export default function LoadingMark({ size = 28, className = '' }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={`hs-loading-mark ${className}`.trim()}
      aria-hidden="true"
      animate={reduceMotion ? undefined : { opacity: [0.72, 1, 0.72], scale: [0.98, 1, 0.98] }}
      transition={reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <ParleMark size={size} title="Loading" />
    </motion.div>
  )
}
