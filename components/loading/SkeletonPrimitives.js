import { motion } from 'framer-motion'
import { spring } from '../../lib/motion'

export function SkeletonBlock({ className = '', style, rounded = 'hs-skeleton-block--round-md' }) {
  return (
    <div
      className={`hs-skeleton-block ${rounded} ${className}`.trim()}
      style={style}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`hs-skeleton-text ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className="hs-skeleton-block--line"
          style={{ width: i === lines - 1 ? '72%' : '100%' }}
          rounded="hs-skeleton-block--round-full"
        />
      ))}
    </div>
  )
}

export function SkeletonButton({ className = 'hs-skeleton-block--btn', rounded = 'hs-skeleton-block--round-full' }) {
  return (
    <SkeletonBlock
      className={className}
      rounded={rounded}
      aria-busy="true"
      aria-label="Loading"
    />
  )
}

export function CardSkeleton({ children, className = '' }) {
  return (
    <motion.div
      className={`hs-skeleton-card ${className}`.trim()}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
      aria-hidden="true"
    >
      {children}
    </motion.div>
  )
}

export function PageSkeleton({ children, className = '' }) {
  return (
    <div className={`hs-page-skeleton ${className}`.trim()} aria-hidden="true">
      {children}
    </div>
  )
}
