import { Heart } from 'lucide-react'
import { TESTIMONIALS } from '../../data/testimonials'

function splitIntoLanes(items, lanes = 3) {
  const result = Array.from({ length: lanes }, () => [])
  items.forEach((item, i) => {
    result[i % lanes].push(item)
  })
  return result
}

function TestimonialCard({ quote, name, age }) {
  return (
    <article className="pss-vtest__card">
      <p className="pss-vtest__quote">&ldquo;{quote}&rdquo;</p>
      <div className="pss-vtest__meta">
        <div className="pss-vtest__avatar" aria-hidden>
          <Heart className="w-4 h-4 text-primary" />
        </div>
        <div className="pss-vtest__who">
          <span className="pss-vtest__name">{name}</span>
          <span className="pss-vtest__age">Age {age}</span>
        </div>
      </div>
    </article>
  )
}

function VerticalLane({ items, direction, speed, delay = '0s' }) {
  const loop = [...items, ...items]

  return (
    <div className="pss-vtest__lane">
      <div
        className={`pss-vtest__track pss-vtest__track--${direction}`}
        style={{ animationDuration: `${speed}s`, animationDelay: delay }}
      >
        {loop.map((item, i) => (
          <TestimonialCard key={`${item.name}-${i}`} {...item} />
        ))}
      </div>
    </div>
  )
}

const LANES = splitIntoLanes(TESTIMONIALS, 3)
const LANE_CONFIG = [
  { direction: 'up', speed: 48, delay: '0s' },
  { direction: 'down', speed: 54, delay: '-12s' },
  { direction: 'up', speed: 60, delay: '-6s' },
]

export default function VerticalTestimonialsSpin() {
  return (
    <section id="voices" className="px-6 md:px-12 py-20 pss-section-voices pss-vtest-section">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="font-serif text-4xl md:text-5xl">You&apos;re not alone</h2>
        <p className="mt-4 text-muted-foreground">Others have been where you are now</p>
      </div>

      <div className="pss-vtest mt-12 max-w-5xl mx-auto" aria-label="Community testimonials">
        <div className="pss-vtest__fade pss-vtest__fade--top" aria-hidden />
        <div className="pss-vtest__fade pss-vtest__fade--bottom" aria-hidden />

        <div className="pss-vtest__grid">
          {LANES.map((lane, i) => (
            <VerticalLane
              key={i}
              items={lane}
              direction={LANE_CONFIG[i].direction}
              speed={LANE_CONFIG[i].speed}
              delay={LANE_CONFIG[i].delay}
            />
          ))}
        </div>
      </div>

      <div className="pss-vtest__static max-w-5xl mx-auto mt-8" aria-label="Testimonials">
        {TESTIMONIALS.slice(0, 6).map((item) => (
          <TestimonialCard key={item.name} {...item} />
        ))}
      </div>
    </section>
  )
}
