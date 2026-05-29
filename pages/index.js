import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { MessageCircle, Mail, BookOpen, Quote } from 'lucide-react'
import HeartstringsSVG from '../components/landing/HeartstringsSVG'
import FeatureCard from '../components/landing/FeatureCard'
import LandingSplash from '../components/landing/LandingSplash'
import TestimonialsMarquee from '../components/landing/TestimonialsMarquee'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const signupDeclined = router.query.signup === 'declined'
  const containerRef = useRef(null)

  function featureHref(path) {
    return loggedIn ? path : `/login?next=${path}`
  }

  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        if (data?.user) {
          router.replace('/dashboard')
          return
        }
        setLoggedIn(false)
        setChecking(false)
      })
      .catch(() => {
        if (active) setChecking(false)
      })
    return () => { active = false }
  }, [router])

  if (checking) {
    return <LandingSplash />
  }

  return (
    <div ref={containerRef} className="landing-hero-page">
      <div className="landing-hero-page__backdrop" aria-hidden="true" />

      <div className="landing-hero-page__content">
        {signupDeclined ? (
          <div className="landing-hero-page__notice px-6" role="status">
            <p>
              You chose not to accept the Terms &amp; Safety Agreement, so account creation is not available.
              You can review the agreement again from the{' '}
              <Link href="/register">signup page</Link> when you are ready.
            </p>
          </div>
        ) : null}

        <section className="landing-hero-page__hero flex flex-col items-center justify-center px-6 py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="w-full max-w-2xl mx-auto mb-12"
          >
            <HeartstringsSVG />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="landing-hero-page__headline text-5xl md:text-6xl lg:text-7xl mb-6">
              A quiet place to let it out
            </h1>
            <p className="landing-hero-page__lead text-xl md:text-2xl mb-8 leading-relaxed">
              When your heart needs space to heal, we're here
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href={featureHref('/register')}
                className="inline-flex px-8 py-4 bg-[var(--hs-auth-red)] text-white rounded-full text-lg font-medium shadow-lg hover:shadow-xl hover:bg-[var(--hs-auth-red-hover)] transition-all"
              >
                Join Heartstrings Club
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1 }}
            className="mt-16 text-center"
          >
            <p className="text-sm" style={{ color: 'rgba(138, 122, 122, 1)' }}>
              Scroll to explore
            </p>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="mt-2"
              aria-hidden="true"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto text-[#b8877a]">
                <path d="M12 5v14m0 0l-7-7m7 7l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </motion.div>
        </section>
      </div>

      <div className="landing-hero-page__below">
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl lg:text-5xl mb-4" style={{ color: '#3a2f2f' }}>
                Your way through
              </h2>
              <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: '#8a7a7a' }}>
                Choose how you want to process. Every path is yours.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FeatureCard
                icon={MessageCircle}
                title="Talk it through"
                description="Chat with an AI that listens without judgment. Share your thoughts whenever you need to, day or night."
                delay={0.1}
                href={featureHref('/chat')}
              />
              <FeatureCard
                icon={Mail}
                title="Write what you can't say"
                description="Compose letters you'll never send. Get it all out in words meant only for you."
                delay={0.2}
                href={featureHref('/letter-to-yourself')}
              />
              <FeatureCard
                icon={BookOpen}
                title="Keep it private"
                description="Your personal diary to track your feelings, progress, and reflections over time."
                delay={0.3}
                href={featureHref('/diary')}
              />
              <FeatureCard
                icon={Quote}
                title="Feel understood"
                description="Curated quotes and thoughts from others who've been where you are now."
                delay={0.4}
                href={featureHref('/quotes')}
              />
            </div>
          </div>
        </section>

        <section className="py-20 px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="backdrop-blur-sm border rounded-3xl p-12 md:p-16" style={{ backgroundColor: 'rgba(255,255,255,0.4)', borderColor: 'rgba(212,129,143,0.15)' }}>
              <h2 className="text-3xl md:text-4xl mb-6" style={{ color: '#3a2f2f' }}>
                Safe. Private. Yours.
              </h2>
              <p className="text-lg md:text-xl leading-relaxed mb-8" style={{ color: 'rgba(58, 47, 47, 0.7)' }}>
                Heartbreak doesn't follow a timeline. There's no &quot;right way&quot; to feel. This is your space to be honest, to be messy, to be human.
              </p>
              <p className="text-base md:text-lg" style={{ color: '#8a7a7a' }}>
                No pressure. No judgment. Just you and what you need to say.
              </p>
            </div>
          </motion.div>
        </section>

        <TestimonialsMarquee />

        <section className="py-20 px-6 mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ color: '#3a2f2f' }}>
              Ready to let it out?
            </h2>
            <p className="text-lg md:text-xl mb-8" style={{ color: '#8a7a7a' }}>
              Join Heartstrings Club and find your quiet space to heal
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href={featureHref(loggedIn ? '/chat' : '/register')}
                className="inline-flex px-10 py-5 bg-[var(--hs-auth-red)] text-white rounded-full text-lg font-medium shadow-xl hover:shadow-2xl hover:bg-[var(--hs-auth-red-hover)] transition-all"
              >
                Get Started
              </Link>
            </motion.div>
            <p className="mt-6 text-sm" style={{ color: '#8a7a7a' }}>
              Free to start. Your privacy protected.
            </p>
          </motion.div>
        </section>
      </div>
    </div>
  )
}
