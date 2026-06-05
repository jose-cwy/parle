import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { TESTIMONIALS } from '../../data/testimonials'

function TestimonialCard({ quote, name, age }) {
  return (
    <motion.div
      className="rounded-xl p-6 min-w-[350px] max-w-[350px] flex-shrink-0"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(45, 37, 32, 0.06)',
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <p className="mb-3 italic" style={{ color: 'var(--foreground)' }}>
        &ldquo;{quote}&rdquo;
      </p>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(239, 68, 68, 0.1)' }}
        >
          <Heart className="w-4 h-4" style={{ color: 'var(--primary)' }} strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {name}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Age {age}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

export default function LandingTestimonialCarousel() {
  const [position, setPosition] = useState(0)
  const items = [...TESTIMONIALS, ...TESTIMONIALS, ...TESTIMONIALS]

  useEffect(() => {
    const timer = setInterval(() => {
      setPosition((prev) => prev - 1)
    }, 50)
    return () => clearInterval(timer)
  }, [])

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="py-24 px-6 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), transparent 55%)' }}
      aria-labelledby="landing-testimonials-heading"
    >
      <div className="lf-container mb-12">
        <h2
          id="landing-testimonials-heading"
          className="lf-serif text-4xl md:text-5xl text-center mb-4"
          style={{ color: 'var(--foreground)' }}
        >
          You&apos;re not alone
        </h2>
        <p className="text-center text-lg" style={{ color: 'var(--muted-foreground)' }}>
          Others have been where you are now
        </p>
      </div>

      <div className="relative overflow-hidden">
        <motion.div
          animate={{ x: position }}
          className="flex gap-6 py-4 px-6"
          style={{ width: 'max-content' }}
        >
          {items.map((item, idx) => (
            <TestimonialCard
              key={`${item.name}-${idx}`}
              quote={item.quote}
              name={item.name}
              age={item.age}
            />
          ))}
        </motion.div>
      </div>
    </motion.section>
  )
}
