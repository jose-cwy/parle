import { motion } from 'framer-motion'
import { stagger, hoverGlow } from '../../lib/motion'

/**
 * Glass testimonial cards — community phase.
 */
export default function GlassTestimonialGrid({ items }) {
  return (
    <motion.div
      className="glass-testimonial-grid"
      variants={stagger.container}
      initial="initial"
      animate="animate"
    >
      {items.map((t) => (
        <motion.article
          key={t.name}
          className="glass-testimonial-card glass-testimonial-card--late-night"
          variants={stagger.item}
          {...hoverGlow}
        >
          <div className="glass-testimonial-card__mark" aria-hidden="true">&ldquo;</div>
          <p className="glass-testimonial-card__quote">{t.quote}</p>
          <p className="glass-testimonial-card__meta">— {t.name}, {t.age}</p>
        </motion.article>
      ))}
    </motion.div>
  )
}
