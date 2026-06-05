import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'

function BadgeIcon() {
  return (
    <svg className="w-5 h-5" style={{ color: 'var(--primary)' }} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function LandingClosingCta() {
  const reduceMotion = useReducedMotion()

  const reveal = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-80px' },
          transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
        }

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0 }}
      whileInView={reduceMotion ? undefined : { opacity: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8 }}
      className="py-32 px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05) 50%, transparent)' }}
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-10 left-10 w-32 h-32 rounded-full blur-3xl"
          style={{ background: 'var(--primary)' }}
        />
        <div
          className="absolute bottom-10 right-10 w-40 h-40 rounded-full blur-3xl"
          style={{ background: 'var(--primary)' }}
        />
      </div>

      <div className="lf-container max-w-4xl text-center relative z-10">
        <motion.h2
          {...reveal(0)}
          className="lf-serif text-5xl md:text-6xl mb-6 leading-tight"
          style={{ color: 'var(--foreground)' }}
        >
          Need someone right now?
        </motion.h2>
        <motion.p
          {...reveal(0.2)}
          className="text-xl mb-12"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Start with one option that matches how you feel — then talk.
        </motion.p>

        <motion.div
          {...reveal(0.3)}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
        >
          <motion.div whileHover={reduceMotion ? undefined : { scale: 1.05 }} whileTap={reduceMotion ? undefined : { scale: 0.95 }}>
            <Link href="/chat" className="lf-btn-primary lf-btn-primary--xl">
              Talk now (no account needed)
            </Link>
          </motion.div>
          <motion.div whileHover={reduceMotion ? undefined : { scale: 1.05 }} whileTap={reduceMotion ? undefined : { scale: 0.95 }}>
            <Link href="/register" className="lf-btn-outline lf-btn-outline--xl">
              Create an account
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          {...reveal(0.5)}
          className="flex flex-wrap justify-center gap-6 text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <div className="flex items-center gap-2">
            <BadgeIcon />
            <span>Free to start</span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeIcon />
            <span>No credit card</span>
          </div>
          <div className="flex items-center gap-2">
            <BadgeIcon />
            <span>Private by default</span>
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}
