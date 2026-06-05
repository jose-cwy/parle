import { motion } from 'framer-motion'

const STEPS = [
  {
    emoji: '💬',
    title: 'Share freely',
    description: 'Talk as much as you need. No pressure, no judgment.',
  },
  {
    emoji: '🧠',
    title: 'We remember',
    description: 'Your story matters. Context-aware support that understands.',
  },
  {
    emoji: '🔒',
    title: '100% private',
    description: 'Private by default. Never sold or analyzed.',
  },
]

const PROS = [
  { title: 'Private & safe', desc: 'Encrypted, never shared' },
  { title: 'Remembers your story', desc: 'Context-aware support' },
  { title: 'Available 24/7', desc: 'When friends are asleep' },
  { title: 'No rush to heal', desc: 'Your pace, your journey' },
]

const CONS = [
  { title: 'Generic responses', desc: 'No personal context' },
  { title: 'Data sold for ads', desc: 'Privacy concerns' },
  { title: 'Friends need sleep', desc: 'Limited availability' },
  { title: '"Just move on"', desc: 'Rushed healing' },
]

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="lf-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="lf-serif text-4xl md:text-5xl mb-4" style={{ color: 'var(--foreground)' }}>
            How parlé works for you
          </h2>
          <p className="text-xl" style={{ color: 'var(--muted-foreground)' }}>
            Support when you need it. Privacy always.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {STEPS.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15, duration: 0.6 }}
              className="text-center"
            >
              <motion.div
                whileHover={{ scale: 1.1, rotate: 10 }}
                transition={{ duration: 0.3 }}
                className="text-6xl mb-4"
              >
                {item.emoji}
              </motion.div>
              <h3 className="lf-serif text-2xl mb-2" style={{ color: 'var(--foreground)' }}>
                {item.title}
              </h3>
              <p style={{ color: 'var(--muted-foreground)' }}>{item.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: '0 10px 15px -3px rgba(45, 37, 32, 0.08)',
          }}
        >
          <div className="p-8">
            <h3 className="lf-serif text-2xl text-center mb-8" style={{ color: 'var(--foreground)' }}>
              parlé vs other support
            </h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                {PROS.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="lf-check-icon"><CheckIcon /></div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-4 opacity-50">
                {CONS.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="lf-x-icon"><XIcon /></div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
