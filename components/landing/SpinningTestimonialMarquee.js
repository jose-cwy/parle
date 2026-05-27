import { useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { LANDING_TESTIMONIALS } from '../../lib/landingTestimonials'

function TestimonialCard({ quote, name, age }) {
  return (
    <article className="landing-marquee__card">
      <div className="landing-marquee__mark" aria-hidden="true">&ldquo;</div>
      <p className="landing-marquee__quote">{quote}</p>
      <p className="landing-marquee__meta">— {name}, {age}</p>
    </article>
  )
}

function MarqueeTrack({ items, reverse = false }) {
  const doubled = [...items, ...items]
  return (
    <div
      className={`landing-marquee__track${reverse ? ' landing-marquee__track--reverse' : ''}`}
      aria-hidden={reverse ? 'true' : undefined}
    >
      {doubled.map((t, i) => (
        <TestimonialCard key={`${t.name}-${i}`} {...t} />
      ))}
    </div>
  )
}

/**
 * Infinite horizontal testimonial marquee — calm social proof.
 * Pauses on hover; static grid when prefers-reduced-motion.
 */
export default function SpinningTestimonialMarquee() {
  const reduceMotion = useReducedMotion()
  const [paused, setPaused] = useState(false)

  const half = Math.ceil(LANDING_TESTIMONIALS.length / 2)
  const rowA = LANDING_TESTIMONIALS.slice(0, half)
  const rowB = LANDING_TESTIMONIALS.slice(half)

  if (reduceMotion) {
    return (
      <div className="landing-marquee landing-marquee--static" aria-label="Community stories">
        <div className="landing-marquee__grid">
          {LANDING_TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.name} {...t} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`landing-marquee${paused ? ' landing-marquee--paused' : ''}`}
      aria-label="Community stories"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
      }}
    >
      <MarqueeTrack items={rowA} />
      <MarqueeTrack items={rowB.length ? rowB : rowA} reverse />
    </div>
  )
}
