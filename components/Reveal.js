import { motion } from 'framer-motion'

/**
 * Shared scroll reveal with a slightly richer lift and softness.
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
  distance = 24,
  scale = 0.985,
  once = true
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance, scale }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
