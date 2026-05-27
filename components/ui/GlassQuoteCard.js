import { motion } from 'framer-motion'

/**
 * Glass sanctuary quote block — moon phase (21st-inspired, on-brand).
 */
export default function GlassQuoteCard({ eyebrow, quote, support, supportStyle }) {
  return (
    <motion.div
      className="glass-quote-card"
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="glass-quote-card__shine" aria-hidden="true" />
      {eyebrow && <p className="moon-phase-eyebrow">{eyebrow}</p>}
      <div className="glass-quote-card__mark" aria-hidden="true">&ldquo;</div>
      <p className="moon-phase-quote glass-quote-card__text">{quote}</p>
      {support && (
        <motion.p
          className="moon-phase-support"
          style={supportStyle || undefined}
        >
          {support}
        </motion.p>
      )}
      <div className="glass-quote-card__divider" aria-hidden="true" />
    </motion.div>
  )
}
