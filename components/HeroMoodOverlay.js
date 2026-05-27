import { motion, useReducedMotion } from 'framer-motion'

/**
 * Film grain + cool anger wash over the sticky stage (hero band).
 */
export default function HeroMoodOverlay({ coolStrength = 0.55, visible }) {
  const reduceMotion = useReducedMotion()
  if (!visible || reduceMotion) return null

  return (
    <motion.div
      className="hero-mood-overlay"
      aria-hidden="true"
      style={{ opacity: coolStrength }}
    >
      <div className="hero-mood-overlay__cool" />
      <div className="hero-mood-overlay__grain" />
    </motion.div>
  )
}
