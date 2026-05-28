import { motion } from 'framer-motion'
import { spring } from '../../lib/motion'

export default function AppCard({ children, className = '', as: Tag = 'div', hover = false, ...props }) {
  const classNames = `hs-app-card${hover ? ' hs-app-card--hover' : ''} ${className}`.trim()
  if (Tag === motion.div) {
    return (
      <motion.div className={classNames} transition={spring.gentle} {...props}>
        {children}
      </motion.div>
    )
  }
  return (
    <Tag className={classNames} {...props}>
      {children}
    </Tag>
  )
}
