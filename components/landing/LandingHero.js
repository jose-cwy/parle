import { useMemo, useRef } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import HeartstringsSVG from './HeartstringsSVG'

export default function LandingHero({ loggedIn, chatHref }) {
  const reduceMotion = useReducedMotion()
  const sectionRef = useRef(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  const scrollCueOpacity = useTransform(scrollYProgress, [0, 0.12, 0.35], [1, 1, 0])
  const gradientOpacity = useTransform(scrollYProgress, [0, 0.35, 1], [1, 0.75, 0.45])
  const gradientY = useTransform(scrollYProgress, [0, 1], ['0%', '50%'])

  const primaryCtaNote = useMemo(() => {
    return loggedIn ? 'Your words stay private.' : 'Free to start. Private by design.'
  }, [loggedIn])

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden" aria-label="Heartstrings Club hero">
      <motion.div
        className="fixed inset-0 pointer-events-none"
        style={{ opacity: gradientOpacity, y: gradientY }}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#ffd4a3] via-[#f7c6a8] to-[#e6b8c9] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#b89dc7]/30 via-transparent to-[#8b7ba8]/20" />
      </motion.div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-20">
        <motion.p className="text-sm text-[color:var(--landing-text-muted)]" style={{ opacity: scrollCueOpacity }}>
          Scroll to explore
        </motion.p>

        <motion.div
          initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl mx-auto mb-10"
        >
          <HeartstringsSVG className="w-full h-auto" />
        </motion.div>

        <motion.div
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-3xl mx-auto"
        >
          <h1 className="text-5xl md:text-6xl lg:text-7xl mb-6 bg-gradient-to-r from-[#d4818f] via-[#f7c6a8] to-[#e6b8c9] bg-clip-text text-transparent font-[var(--font-serif)]">
            A quiet place to let it out
          </h1>
          <p className="text-xl md:text-2xl text-[color:var(--landing-text)]/70 mb-8 leading-relaxed">
            Private breakup support — chat when you need to talk, then letters, diary, and quotes in your own space.
          </p>

          <div className="flex flex-col items-center gap-3">
            <motion.div whileHover={reduceMotion ? undefined : { scale: 1.04 }} whileTap={reduceMotion ? undefined : { scale: 0.98 }}>
              <Link
                href={chatHref}
                className="inline-flex items-center justify-center px-8 py-4 rounded-full text-lg font-medium text-white shadow-lg hover:shadow-xl transition-shadow"
                style={{ backgroundColor: '#d4818f' }}
              >
                Talk it out
              </Link>
            </motion.div>
            <p className="text-sm text-[color:var(--landing-text-muted)]">{primaryCtaNote}</p>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, 10, 0] }}
            transition={reduceMotion ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="mt-2"
            aria-hidden="true"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mx-auto text-[#d4818f]">
              <path d="M12 5v14m0 0l-7-7m7 7l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
