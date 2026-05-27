import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { beatReveal, beatVisualReveal, beatVisualRevealLeft } from '../../lib/landingMotion'
import { hoverLift } from '../../lib/motion'

const viewOnce = { once: true, margin: '-72px' }

export default function FeatureBeat({
  id,
  eyebrow,
  title,
  promise,
  beat,
  href,
  linkLabel,
  visual,
  imageSrc,
  imageAlt = '',
  reverse = false,
  featured = false,
}) {
  const reduceMotion = useReducedMotion()
  const copyMotion = reduceMotion ? {} : { variants: beatReveal, initial: 'hidden', whileInView: 'visible', viewport: viewOnce }
  const visualMotion = reduceMotion
    ? {}
    : {
        variants: reverse ? beatVisualRevealLeft : beatVisualReveal,
        initial: 'hidden',
        whileInView: 'visible',
        viewport: viewOnce,
      }

  return (
    <article
      id={id}
      className={`feature-beat${reverse ? ' feature-beat--reverse' : ''}${featured ? ' feature-beat--featured' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <motion.div className="feature-beat__copy" {...copyMotion}>
        {eyebrow && <p className="feature-beat__eyebrow">{eyebrow}</p>}
        <h3 id={`${id}-title`} className="feature-beat__title">
          {title}
        </h3>
        <p className="feature-beat__promise">{promise}</p>
        <p className="feature-beat__beat">{beat}</p>
        <Link href={href} className="feature-beat__link">
          {linkLabel}
        </Link>
      </motion.div>

      <motion.div className="feature-beat__visual" {...visualMotion} {...(reduceMotion ? {} : hoverLift)}>
        <div className="feature-beat__visual-frame">
          {imageSrc && (
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              sizes="(max-width: 900px) 100vw, 42vw"
              className="feature-beat__visual-img"
            />
          )}
          {visual && <div className="feature-beat__visual-panel">{visual}</div>}
          <div className="feature-beat__visual-grain" aria-hidden="true" />
        </div>
      </motion.div>
    </article>
  )
}
