import { motion } from 'framer-motion'
import { spring, hoverGlow } from '../lib/motion'

export default function AnimatedCard({ children, className = '', hover = true, delay = 0 }){
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ ...spring.gentle, delay, opacity: { duration: 0.5 } }}
      whileHover={hover ? { y: -4, scale: 1.008, transition: spring.breath } : undefined}
      whileTap={hover ? { scale: 0.99, y: 0, transition: spring.snappy } : undefined}
      className={`card ${className}`}
    >
      {children}
    </motion.div>
  )
}
