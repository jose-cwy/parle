import Link from 'next/link'
import { motion } from 'framer-motion'
import FeatureIcon from '../FeatureIcon'
import { spring, hoverGlow } from '../../lib/motion'

/**
 * Hand-drawn poster card — taped corners, slight tilt, lo-fi bedroom wall aesthetic.
 */
export default function PosterCard({
  title,
  description,
  href,
  icon,
  index = 0,
  accent = 'warm',
  className = '',
}) {
  const rotations = [-2.5, 1.8, -1.2, 2.2]
  const rotate = rotations[index % rotations.length]
  const accentClass =
    accent === 'sage'
      ? 'poster-card-sage'
      : accent === 'terracotta'
        ? 'poster-card-terracotta'
        : 'poster-card-warm'

  const content = (
    <motion.article
      className={`poster-card ${accentClass} ${className}`}
      style={{ '--poster-tilt': `${rotate}deg` }}
      initial={{ opacity: 0, y: 28, rotate: rotate - 4, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, rotate, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ ...spring.gentle, delay: index * 0.07 }}
      whileHover={{ y: -6, rotate: rotate + 0.5, transition: spring.breath }}
      whileTap={{ scale: 0.99, transition: spring.snappy }}
    >
      <span className="poster-tape poster-tape-left" aria-hidden="true" />
      <span className="poster-tape poster-tape-right" aria-hidden="true" />
      <div className="poster-card-inner">
        <div className="flex items-start justify-between gap-3">
          <FeatureIcon name={icon} />
          <span className="poster-pin" aria-hidden="true" />
        </div>
        <span className="poster-number">0{index + 1}</span>
        <h3 className="poster-title">{title}</h3>
        <p className="poster-desc">{description}</p>
        <motion.span className="poster-cta" {...hoverGlow}>
          Open the door →
        </motion.span>
      </div>
    </motion.article>
  )

  if (href) {
    return (
      <Link href={href} className="block cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] rounded-[22px]">
        {content}
      </Link>
    )
  }

  return content
}
