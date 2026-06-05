import Link from 'next/link'
import { motion } from 'framer-motion'
import LandingChatPreview from './LandingChatPreview'

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 px-6 lg:pt-40">
      <motion.div
        className="lf-blob-a absolute top-20 right-10 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(239, 68, 68, 0.05)' }}
        aria-hidden="true"
      />
      <motion.div
        className="lf-blob-b absolute bottom-20 left-10 w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(239, 68, 68, 0.05)' }}
        aria-hidden="true"
      />

      <div className="lf-container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="lf-serif text-5xl md:text-6xl lg:text-7xl mb-6 leading-tight"
              style={{ color: 'var(--foreground)' }}
            >
              For the nights when you miss them
              <br />
              <span style={{ color: 'var(--primary)' }}>and your friends are asleep</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-xl mb-4"
              style={{ color: 'var(--muted-foreground)' }}
            >
              A private heartbreak support space. Comfort first. Advice when you&apos;re ready.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-base mb-8"
              style={{ color: 'var(--muted-foreground)' }}
            >
              🔒 Private by default · 🛡️ Not therapy · 💬 Short replies
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/chat" className="lf-btn-primary lf-btn-primary--lg">
                  Talk now (no account needed)
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <a href="#how-it-works" className="lf-btn-outline lf-btn-outline--lg">
                  See how it works
                </a>
              </motion.div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
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
