import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  TESTIMONIALS,
  TESTIMONIALS_ROW_BOTTOM,
  TESTIMONIALS_ROW_TOP,
} from '../../data/testimonials'

function TestimonialCard({ name, age, quote, size = 'md' }) {
  return (
    <article
      className={`testimonials-marquee__card testimonials-marquee__card--${size}`}
      aria-label={`Testimonial from ${name}, ${age}`}
    >
      <span className="testimonials-marquee__mark" aria-hidden="true">
        &ldquo;
      </span>
      <p className="testimonials-marquee__quote">{quote}</p>
      <p className="testimonials-marquee__meta">
        <span className="testimonials-marquee__name">{name}</span>
        <span className="testimonials-marquee__age" aria-label={`age ${age}`}>
          {age}
        </span>
      </p>
    </article>
  )
}

function MarqueeRow({ items, direction, paused, duplicate }) {
  const loop = duplicate ? [...items, ...items] : items
  const trackClass = [
    'testimonials-marquee__track',
    `testimonials-marquee__track--${direction}`,
    paused ? 'testimonials-marquee__track--paused' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="testimonials-marquee__row">
      <div className="testimonials-marquee__viewport">
        <div className={trackClass}>
          {loop.map((item, i) => (
            <TestimonialCard
              key={`${item.name}-${i}`}
              name={item.name}
              age={item.age}
              quote={item.quote}
              size={i % 3 === 0 ? 'sm' : i % 3 === 1 ? 'md' : 'lg'}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TestimonialsMarquee() {
  const [paused, setPaused] = useState(false)
  const [duplicateRows, setDuplicateRows] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setDuplicateRows(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <section
      className="testimonials-marquee"
      aria-labelledby="testimonials-heading"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
    >
      <div className="testimonials-marquee__header">
        <motion.h2
          id="testimonials-heading"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="testimonials-marquee__title"
        >
          You&apos;re not alone
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="testimonials-marquee__subtitle"
        >
          Quiet words from people who needed somewhere private to put their thoughts.
        </motion.p>
      </div>

      <div className="testimonials-marquee__fade testimonials-marquee__fade--left" aria-hidden="true" />
      <div className="testimonials-marquee__fade testimonials-marquee__fade--right" aria-hidden="true" />

      <div className="testimonials-marquee__rows">
        <MarqueeRow
          items={TESTIMONIALS_ROW_TOP}
          direction="ltr"
          paused={paused}
          duplicate={duplicateRows}
        />
        <MarqueeRow
          items={TESTIMONIALS_ROW_BOTTOM}
          direction="rtl"
          paused={paused}
          duplicate={duplicateRows}
        />
      </div>

      <div className="testimonials-marquee__static" aria-label="Testimonials">
        {TESTIMONIALS.map((item) => (
          <TestimonialCard key={item.name} {...item} size="md" />
        ))}
      </div>
    </section>
  )
}
