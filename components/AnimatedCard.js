import { motion } from 'framer-motion'

export default function AnimatedCard({ children, className = '', hover = true }){
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover ? { y: -8, scale: 1.01 } : undefined}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`card ${className}`}
    >
      {children}
    </motion.div>
  )
}
