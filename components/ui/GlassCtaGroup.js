import Link from 'next/link'
import { motion } from 'framer-motion'
import { spring } from '../../lib/motion'

/**
 * Gradient-bordered CTA group — final scroll phase.
 */
export default function GlassCtaGroup({ primary, secondary }) {
  return (
    <div className="glass-cta-group">
      {primary && (
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={spring.snappy}>
          <Link href={primary.href} className="glass-cta-group__primary">
            {primary.label}
          </Link>
        </motion.div>
      )}
      {secondary?.map((item) => (
        <motion.div
          key={item.href}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={spring.breath}
        >
          <Link href={item.href} className="glass-cta-group__secondary">
            {item.label}
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
