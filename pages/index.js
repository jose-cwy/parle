import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, useScroll, useTransform } from 'framer-motion'
import { MessageCircle, Mail, BookOpen, Quote } from 'lucide-react'
import HeartstringsSVG from '../components/landing/HeartstringsSVG'
import FeatureCard from '../components/landing/FeatureCard'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [hasUserScrolled, setHasUserScrolled] = useState(false)
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  const gradientOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [1, 0.8, 0.6, 0.4])
  const gradientY = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])

  useEffect(() => {
    function onFirstScroll() {
      setHasUserScrolled(true)
      window.removeEventListener('scroll', onFirstScroll)
      window.removeEventListener('touchmove', onFirstScroll)
      window.removeEventListener('wheel', onFirstScroll)
    }

    window.addEventListener('scroll', onFirstScroll, { passive: true })
    window.addEventListener('touchmove', onFirstScroll, { passive: true })
    window.addEventListener('wheel', onFirstScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onFirstScroll)
      window.removeEventListener('touchmove', onFirstScroll)
      window.removeEventListener('wheel', onFirstScroll)
    }
  }, [])

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
    return (
      <div className="landing-page__loading" aria-busy="true">
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden" style={{ backgroundColor: '#fdf8f6' }}>
      <motion.div
        className="fixed inset-0 pointer-events-none"
        style={{ opacity: hasUserScrolled ? gradientOpacity : 1, y: hasUserScrolled ? gradientY : 0 }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#ffd4a3] via-[#f7c6a8] to-[#e6b8c9] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#b89dc7]/30 via-transparent to-[#8b7ba8]/20" />
      </motion.div>

      <div className="relative z-10">
        <section className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="w-full max-w-2xl mx-auto mb-12"
          >
            <HeartstringsSVG className="w-full h-auto" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl lg:text-7xl mb-6 bg-gradient-to-r from-[#d4818f] via-[#f7c6a8] to-[#e6b8c9] bg-clip-text text-transparent">
              A quiet place to let it out
            </h1>
            <p className="text-xl md:text-2xl mb-8 leading-relaxed" style={{ color: 'rgba(58, 47, 47, 0.7)' }}>
              When your heart needs space to heal, we're here
            </p>
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href={loggedIn ? '/chat' : '/login?next=/chat'}
              className="inline-flex px-8 py-4 bg-[#d4818f] text-white rounded-full text-lg font-medium shadow-lg hover:shadow-xl transition-shadow"
            >
              Join Heartstrings Club
            </motion.a>
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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto text-[#d4818f]">
                <path d="M12 5v14m0 0l-7-7m7 7l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </motion.div>
        </section>

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
              />
              <FeatureCard
                icon={Mail}
                title="Write what you can't say"
                description="Compose letters you'll never send. Get it all out in words meant only for you."
                delay={0.2}
              />
              <FeatureCard
                icon={BookOpen}
                title="Keep it private"
                description="Your personal diary to track your feelings, progress, and reflections over time."
                delay={0.3}
              />
              <FeatureCard
                icon={Quote}
                title="Feel understood"
                description="Curated quotes and thoughts from others who've been where you are now."
                delay={0.4}
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

        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl text-center mb-12"
              style={{ color: '#3a2f2f' }}
            >
              You're not alone
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { quote: "Finally, somewhere that gets it. I don't have to explain myself.", author: 'Alex, 24' },
                { quote: "Writing letters I'll never send helped more than I thought possible.", author: 'Jordan, 27' },
                { quote: 'The chat feels like talking to a friend who actually understands.', author: 'Sam, 22' },
              ].map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="backdrop-blur-sm border rounded-2xl p-8"
                  style={{ backgroundColor: 'rgba(255,255,255,0.5)', borderColor: 'rgba(212,129,143,0.15)' }}
                >
                  <p className="mb-4 italic leading-relaxed" style={{ color: 'rgba(58, 47, 47, 0.8)' }}>
                    &quot;{testimonial.quote}&quot;
                  </p>
                  <p className="text-sm" style={{ color: '#8a7a7a' }}>
                    — {testimonial.author}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

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
            <motion.a
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href={loggedIn ? '/chat' : '/login?next=/chat'}
              className="inline-flex px-10 py-5 bg-[#d4818f] text-white rounded-full text-lg font-medium shadow-xl hover:shadow-2xl transition-all"
            >
              Get Started
            </motion.a>
            <p className="mt-6 text-sm" style={{ color: '#8a7a7a' }}>
              Free to start. Your privacy protected.
            </p>
          </motion.div>
        </section>
      </div>
    </div>
  )
}
