import Link from 'next/link'
import { motion } from 'framer-motion'

export default function LandingTrustSection() {
  return (
    <section className="landing-v2-trust">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="landing-v2-trust__card"
      >
        <h2 className="landing-v2-trust__title">Safe. Private. Yours.</h2>
        <p className="landing-v2-trust__lead">
          Heartbreak doesn&apos;t follow a timeline. There&apos;s no “right way” to feel. This is your space to be honest, to be messy, to be human.
        </p>
        <div className="landing-v2-trust__grid">
          <div>
            <p className="landing-v2-trust__label">Privacy-first</p>
            <p className="landing-v2-trust__body">
              No public posts. No feed. Start talking without a real name. Delete your chat anytime.
            </p>
          </div>
          <div>
            <p className="landing-v2-trust__label">Not therapy</p>
            <p className="landing-v2-trust__body">
              parlé is supportive, not clinical, and not for emergencies. If you&apos;re in danger,
              please contact local emergency services or a trusted person.
            </p>
            <p className="landing-v2-trust__terms">
              You can read the full Terms &amp; Safety Agreement on the{' '}
              <Link href="/terms">terms page</Link>.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
