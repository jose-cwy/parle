import { motion } from 'framer-motion'
import { spring } from '../../lib/motion'

export default function StickyBadge({ children, color = 'amber', className = '' }) {
  const colorClass =
    color === 'sage' ? 'sticky-badge-sage' : color === 'cream' ? 'sticky-badge-cream' : 'sticky-badge-amber'

  return (
    <motion.span
      className={`sticky-badge ${colorClass} ${className}`}
      initial={{ opacity: 0, scale: 0.92, rotate: -6 }}
      animate={{ opacity: 1, scale: 1, rotate: -2 }}
      transition={spring.gentle}
    >
      {children}
    </motion.span>
  )
}
