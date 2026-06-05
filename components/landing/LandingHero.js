import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import LandingChatPreview from './LandingChatPreview'

const EASE = [0.22, 1, 0.36, 1]

function fadeUp(reduceMotion, delay = 0) {
  if (reduceMotion) return {}
  return {
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: EASE },
  }
}

export default function LandingHero() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="relative overflow-hidden pt-32 pb-24 px-6 lg:pt-40">
      <motion.div
        className="absolute top-20 right-10 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(239, 68, 68, 0.05)' }}
        aria-hidden="true"
        animate={reduceMotion ? undefined : { y: [0, -20, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-20 left-10 w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(239, 68, 68, 0.05)' }}
        aria-hidden="true"
        animate={reduceMotion ? undefined : { y: [0, 20, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="lf-container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <motion.h1
              {...fadeUp(reduceMotion, 0.15)}
              className="lf-serif text-5xl md:text-6xl lg:text-7xl mb-6 leading-tight"
              style={{ color: 'var(--foreground)' }}
            >
              For the nights when you miss them
              <br />
              <span style={{ color: 'var(--primary)' }}>and your friends are asleep</span>
            </motion.h1>

            <motion.p
              {...fadeUp(reduceMotion, 0.35)}
              className="text-xl mb-4"
              style={{ color: 'var(--muted-foreground)' }}
            >
              A private heartbreak support space. Comfort first. Advice when you&apos;re ready.
            </motion.p>

            <motion.p
              {...fadeUp(reduceMotion, 0.45)}
              className="text-base mb-8"
              style={{ color: 'var(--muted-foreground)' }}
            >
              🔒 Private by default · 🛡️ Not therapy · 💬 Short replies
            </motion.p>

            <motion.div
              {...fadeUp(reduceMotion, 0.6)}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <motion.div whileHover={reduceMotion ? undefined : { scale: 1.05 }} whileTap={reduceMotion ? undefined : { scale: 0.95 }}>
                <Link href="/chat" className="lf-btn-primary lf-btn-primary--lg">
                  Talk now (no account needed)
                </Link>
              </motion.div>
              <motion.div whileHover={reduceMotion ? undefined : { scale: 1.05 }} whileTap={reduceMotion ? undefined : { scale: 0.95 }}>
                <a href="#how-it-works" className="lf-btn-outline lf-btn-outline--lg">
                  See how it works
                </a>
              </motion.div>
            </motion.div>

            <motion.p
              {...fadeUp(reduceMotion, 0.8)}
              className="text-sm mt-6"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Free to start · Private by default
            </motion.p>
          </div>

          <LandingChatPreview />
        </div>
      </div>
    </section>
  )
}
