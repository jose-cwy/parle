import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

export default function Reveal({
  children,
  delay = 0,
  className = '',
  distance = 24,
  scale = 0.97,
  once = true
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance, scale, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once, amount: 0.1, margin: '0px 0px -48px 0px' }}
      transition={{ ...spring.gentle, delay, opacity: { duration: 0.55 } }}
    >
      {children}
    </motion.div>
  )
}
