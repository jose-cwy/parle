import { useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Heart,
  MessageCircle,
  Sparkles,
  BookOpen,
  Quote,
  Check,
  X,
  Lock,
  Brain,
  Coffee,
  PhoneOff,
  GitBranch,
  Volume2,
  ShieldOff,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import VerticalTestimonialsSpin from './VerticalTestimonialsSpin'
import MarketingNav from './MarketingNav'

function SectionEyebrow({ children }) {
  return (
    <p className="pss-section-eyebrow text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">
      {children}
    </p>
  )
}

const SCROLL_SWAP_SLIDE = {
  enter: (direction) => ({
    opacity: 0,
    x: direction * 72,
    filter: 'blur(4px)',
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction * -56,
    filter: 'blur(3px)',
  }),
}

const SCROLL_SWAP_SWIPE_THRESHOLD = 52
const SCROLL_SWAP_GESTURE_COOLDOWN_MS = 420

/** Mobile-only: pin scroll in-section; gestures swap cards until the last is shown */
function MobileScrollSwap({ items, renderItem, trackClassName = '' }) {
  const trackRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const directionRef = useRef(1)
  const scrollPinYRef = useRef(null)
  const sectionActiveRef = useRef(false)
  const sectionReleasedRef = useRef(false)
  const gestureLockRef = useRef(false)
  const touchStartYRef = useRef(0)
  const touchDeltaRef = useRef(0)
  const reduceMotion = useReducedMotion()

  useLayoutEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return undefined

    const mq = window.matchMedia('(max-width: 767px)')
    const stickyTopPx = 72

    function scrollInstant(y) {
      const root = document.documentElement
      const previous = root.style.scrollBehavior
      root.style.scrollBehavior = 'auto'
      window.scrollTo(0, y)
      root.style.scrollBehavior = previous
    }

    function isTrackEngaged() {
      const rect = track.getBoundingClientRect()
      return rect.top <= stickyTopPx + 8 && rect.bottom > stickyTopPx + 120
    }

    function isPinned() {
      return sectionActiveRef.current && !sectionReleasedRef.current
    }

    function pinScrollPosition() {
      if (!isPinned() || scrollPinYRef.current == null) return
      if (Math.abs(window.scrollY - scrollPinYRef.current) > 1) {
        scrollInstant(scrollPinYRef.current)
      }
    }

    function activateSection() {
      if (sectionActiveRef.current || sectionReleasedRef.current || !isTrackEngaged()) return

      sectionActiveRef.current = true
      scrollPinYRef.current = window.scrollY
      touchDeltaRef.current = 0
      activeIndexRef.current = 0
      setActiveIndex(0)
    }

    function releaseSection() {
      if (sectionReleasedRef.current) return

      sectionReleasedRef.current = true
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const releaseY = (scrollPinYRef.current ?? window.scrollY) + viewportHeight * 0.4
      scrollPinYRef.current = null
      scrollInstant(releaseY)
    }

    function setCardIndex(next, direction) {
      if (next === activeIndexRef.current) return
      directionRef.current = direction
      activeIndexRef.current = next
      setActiveIndex(next)
    }

    function runGestureCooldown() {
      gestureLockRef.current = true
      window.setTimeout(() => {
        gestureLockRef.current = false
      }, SCROLL_SWAP_GESTURE_COOLDOWN_MS)
    }

    function handleScrollIntent(direction) {
      if (!mq.matches || !isPinned() || gestureLockRef.current) return

      const current = activeIndexRef.current

      if (direction > 0) {
        if (current >= items.length - 1) {
          runGestureCooldown()
          releaseSection()
          return
        }
        runGestureCooldown()
        setCardIndex(current + 1, 1)
        return
      }

      if (direction < 0 && current > 0) {
        runGestureCooldown()
        setCardIndex(current - 1, -1)
      }
    }

    function pullBackIfSkipped() {
      if (sectionReleasedRef.current || sectionActiveRef.current) return

      const rect = track.getBoundingClientRect()
      if (rect.bottom >= stickyTopPx) return

      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      const entryY = Math.max(0, window.scrollY + rect.top - stickyTopPx)
      scrollInstant(entryY)
      activateSection()
    }

    function onScroll() {
      if (!mq.matches) return

      pullBackIfSkipped()
      activateSection()
      pinScrollPosition()
    }

    function onWheel(event) {
      if (!isPinned()) return

      event.preventDefault()
      pinScrollPosition()

      if (Math.abs(event.deltaY) < 6) return
      handleScrollIntent(event.deltaY > 0 ? 1 : -1)
    }

    function onTouchStart(event) {
      if (!isPinned()) return
      touchStartYRef.current = event.touches[0]?.clientY ?? 0
      touchDeltaRef.current = 0
    }

    function onTouchMove(event) {
      if (!isPinned()) return

      event.preventDefault()
      pinScrollPosition()

      const y = event.touches[0]?.clientY ?? touchStartYRef.current
      touchDeltaRef.current = touchStartYRef.current - y
    }

    function onTouchEnd() {
      if (!isPinned()) return

      pinScrollPosition()

      if (Math.abs(touchDeltaRef.current) < SCROLL_SWAP_SWIPE_THRESHOLD) return
      handleScrollIntent(touchDeltaRef.current > 0 ? 1 : -1)
      touchDeltaRef.current = 0
    }

    function resetSection() {
      sectionActiveRef.current = false
      sectionReleasedRef.current = false
      scrollPinYRef.current = null
      gestureLockRef.current = false
      activeIndexRef.current = 0
      setActiveIndex(0)
    }

    function onMediaChange() {
      if (!mq.matches) {
        resetSection()
        return
      }
      onScroll()
    }

    onScroll()

    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.visualViewport?.addEventListener('scroll', onScroll)
    window.visualViewport?.addEventListener('resize', onScroll)
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    track.addEventListener('touchstart', onTouchStart, { passive: true })
    track.addEventListener('touchmove', onTouchMove, { passive: false })
    track.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true })
    mq.addEventListener('change', onMediaChange)

    return () => {
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('scroll', onScroll, true)
      window.visualViewport?.removeEventListener('scroll', onScroll)
      window.visualViewport?.removeEventListener('resize', onScroll)
      window.removeEventListener('wheel', onWheel, true)
      track.removeEventListener('touchstart', onTouchStart)
      track.removeEventListener('touchmove', onTouchMove)
      track.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchstart', onTouchStart, true)
      window.removeEventListener('touchmove', onTouchMove, true)
      window.removeEventListener('touchend', onTouchEnd, true)
      mq.removeEventListener('change', onMediaChange)
    }
  }, [items.length])

  const activeItem = items[activeIndex] || items[0]
  const activeKey = activeItem?.id || activeItem?.title || activeIndex

  return (
    <div
      ref={trackRef}
      className={`pss-scroll-swap ${trackClassName}`}
      style={{ '--swap-steps': items.length }}
    >
      <div className="pss-scroll-swap__sticky">
        <div className="pss-scroll-swap__stage">
          <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
            <motion.div
              key={activeKey}
              className="pss-scroll-swap__panel"
              custom={directionRef.current}
              variants={reduceMotion ? undefined : SCROLL_SWAP_SLIDE}
              initial={reduceMotion ? false : 'enter'}
              animate="center"
              exit={reduceMotion ? undefined : 'exit'}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 220, damping: 28, mass: 0.95, opacity: { duration: 0.35 } }
              }
            >
              {renderItem(activeItem, activeIndex)}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="pss-scroll-swap__dots" aria-hidden>
          {items.map((item, index) => (
            <span
              key={`dot-${item.id || item.title || index}`}
              className={`pss-scroll-swap__dot${index === activeIndex ? ' pss-scroll-swap__dot--active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function WhatCardContent({ icon: Icon, title, description }) {
  return (
    <>
      <span className="pss-what-card__icon" aria-hidden>
        <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
      </span>
      <h3 className="pss-what-card__title font-serif">{title}</h3>
      <p className="pss-what-card__desc">{description}</p>
    </>
  )
}

function DictionaryHero() {
  return (
    <section id="hero" className="pss-hero-section">
      <div className="pss-hero-inner">
        <div className="pss-hero-block">
          <div className="pss-hero-word">
            <h1 className="pss-hero-title">parlé</h1>
          </div>

          <div className="pss-hero-meta">
            <span className="pss-hero-phonetic">/ par.leɪ /</span>
            <span className="pss-hero-noun">noun</span>
          </div>

          <div className="pss-hero-divider pss-hero-rule" aria-hidden />

          <p className="pss-hero-defs pss-hero-definition pss-hero-definition--desktop">
            A private space to say the things you can&apos;t say out loud.
          </p>
          <p className="pss-hero-defs pss-hero-definition pss-hero-definition--mobile">
            No advice unless you want it. Just space.
          </p>

          <div className="pss-hero-ctas">
            <Link href="/chat" className="pss-hero-btn pss-hero-btn--primary">
              <span className="pss-hero-btn-label--desktop">Start talking</span>
              <span className="pss-hero-btn-label--mobile">just start talking</span>
            </Link>
            <a href="#what" className="pss-hero-btn pss-hero-btn--secondary">
              See how it works
            </a>
          </div>

          <Link href="/login" className="pss-hero-login-link">
            or log in
          </Link>

          <p className="pss-hero-footnote">
            Free to start · Private by default · Available 24/7
          </p>

          <div className="pss-hero-scroll-hint" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}

const WHAT_CARDS = [
  {
    icon: Heart,
    title: 'What it is',
    description:
      "A small, private corner of the internet built for one thing — the messy middle of a breakup. Not a journal app with a chatbot bolted on. Not a generic AI told to be nice. Something made for this.",
  },
  {
    icon: MessageCircle,
    title: "What it's for",
    description:
      "The 2am spiral. The unsent text. The thought you can't say to friends without it becoming a Whole Thing. Talk it out, write it down, or save the line that finally made sense.",
  },
  {
    icon: Sparkles,
    title: 'Why use it',
    description:
      "Because heartbreak doesn't keep office hours, and you shouldn't have to perform okay-ness to get heard. parlé sits with you exactly as you are — no audience, no judgment, no advice you didn't ask for.",
  },
]

function WhatIsParle() {
  return (
    <section id="what" className="pss-what-section px-6 md:px-12 py-20 md:py-28">
      <div className="max-w-6xl mx-auto text-center">
        <SectionEyebrow>What is parlé</SectionEyebrow>
        <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.08]">
          A quiet place for the <span className="italic text-primary">loud</span> feelings.
        </h2>
        <p className="pss-what-section__intro mt-5 text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
          parlé is a heartbreak companion — built to listen, not to fix you.
        </p>

        <MobileScrollSwap
          items={WHAT_CARDS}
          trackClassName="pss-scroll-swap--what"
          renderItem={(card) => (
            <article className="pss-what-card pss-what-card--swap">
              <WhatCardContent {...card} />
            </article>
          )}
        />

        <ul className="pss-what-grid pss-what-grid--desktop">
          {WHAT_CARDS.map(({ icon, title, description }, index) => (
            <motion.li
              key={title}
              className="pss-what-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
            >
              <WhatCardContent icon={icon} title={title} description={description} />
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const PARLE_PROMISE = [
  {
    title: 'Guest mode leaves no trace',
    description: 'No account, no data, no footprint',
  },
  {
    title: 'You control your data',
    description: 'Personalisation is opt-in, not default',
  },
  {
    title: 'Your data stays private',
    description: 'Never sold or shared with third parties',
  },
  {
    title: 'Delete anytime',
    description: 'One click removes everything, instantly',
  },
]

const GENERIC_AI = [
  {
    title: 'Generic chatbot tone',
    description: 'Same script for every kind of pain.',
  },
  {
    title: 'You become the product',
    description: 'Your words become training data and ad signal.',
  },
  {
    title: 'Profiled across every session',
    description: "Always-on memory you can't really turn off.",
  },
  {
    title: '"Have you tried meditation?"',
    description: 'Solutions when you just wanted to be heard.',
  },
]

const PRIVACY_PILLARS = [
  {
    icon: Lock,
    title: 'Encrypted at rest',
    description:
      'Your journal and signed-in chats are encrypted before they ever hit the database.',
  },
  {
    icon: ShieldOff,
    title: 'Personalisation is opt-in',
    description:
      'Cross-session memory and preference learning are off until you turn them on in settings.',
  },
]

function CompareListItem({ title, description, variant = 'yes' }) {
  const isYes = variant === 'yes'
  return (
    <div className={`pss-why-compare__item${isYes ? '' : ' pss-why-compare__item--muted'}`}>
      <span className={isYes ? 'pss-why-compare__icon pss-why-compare__icon--yes' : 'pss-why-compare__icon pss-why-compare__icon--no'}>
        {isYes ? (
          <Check className="w-4 h-4 text-primary-foreground" />
        ) : (
          <X className="w-4 h-4 text-muted-foreground" />
        )}
      </span>
      <div className="pss-why-compare__copy">
        <div className="pss-why-compare__item-title">{title}</div>
        <div className="pss-why-compare__item-desc">{description}</div>
      </div>
    </div>
  )
}

function WhyParle() {
  const comparePairs = PARLE_PROMISE.map((parle, index) => ({
    headline: parle.title,
    parle,
    other: GENERIC_AI[index],
  }))

  return (
    <section id="why" className="pss-why-section px-6 md:px-12 py-20 md:py-28">
      <div className="max-w-6xl mx-auto text-center">
        <SectionEyebrow>Why parlé</SectionEyebrow>
        <h2 className="font-serif text-4xl md:text-5xl tracking-tight">
          Why <span className="italic">parlé</span>, not them
        </h2>
        <p className="mt-4 text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
          Generic AI wasn&apos;t built for this. And it definitely wasn&apos;t built to keep what you said to itself.
        </p>

        <div className="pss-why-compare pss-why-compare--desktop mt-12 md:mt-16">
          <div className="pss-why-compare__panel pss-why-compare__panel--parle">
            <div className="pss-why-compare__panel-head">
              <h3 className="pss-why-compare__panel-title font-serif">parlé</h3>
              <span className="pss-why-compare__badge">our promise</span>
            </div>
            <div className="pss-why-compare__list">
              {PARLE_PROMISE.map(({ title, description }) => (
                <CompareListItem key={title} title={title} description={description} variant="yes" />
              ))}
            </div>
          </div>

          <div className="pss-why-compare__panel pss-why-compare__panel--other">
            <h3 className="pss-why-compare__panel-title font-serif pss-why-compare__panel-title--muted">
              Generic AI tools
            </h3>
            <div className="pss-why-compare__list">
              {GENERIC_AI.map(({ title, description }) => (
                <CompareListItem key={title} title={title} description={description} variant="no" />
              ))}
            </div>
          </div>
        </div>

        <div className="pss-why-compare-mobile mt-10">
          {comparePairs.map(({ headline, parle, other }) => (
            <article key={headline} className="pss-why-compare-mobile__pair">
              <h3 className="pss-why-compare-mobile__headline font-serif">{headline}</h3>
              <p className="pss-why-compare-mobile__label">parlé</p>
              <CompareListItem title={parle.title} description={parle.description} variant="yes" />
              <p className="pss-why-compare-mobile__label pss-why-compare-mobile__label--muted">
                Generic AI tools
              </p>
              <CompareListItem title={other.title} description={other.description} variant="no" />
            </article>
          ))}
        </div>

        <ul className="pss-why-privacy">
          {PRIVACY_PILLARS.map(({ icon: Icon, title, description }) => (
            <li key={title} className="pss-why-privacy__item">
              <span className="pss-why-privacy__icon" aria-hidden>
                <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
              </span>
              <div>
                <p className="pss-why-privacy__title">{title}</p>
                <p className="pss-why-privacy__desc">{description}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-muted-foreground">
          The full breakdown lives in{' '}
          <Link href="/terms" className="text-primary hover:underline underline-offset-2">
            Privacy &amp; Terms &amp; Safety
          </Link>
        </p>
      </div>
    </section>
  )
}

const LANDING_FEATURES = [
  {
    id: 'chat',
    icon: MessageCircle,
    title: 'The chatbot',
    description:
      'An AI companion with six modes — emotional, logical, venting, just talking, stop-me-from-texting-them, and cross-mode. Pick the tone that fits the moment, or let it read you and switch.',
    href: '/chat',
    cta: 'Start a chat',
    primary: true,
  },
  {
    id: 'journal',
    icon: BookOpen,
    title: 'Private journal',
    description:
      'Write entries for yourself. A blank page when you need to get something out of your head and onto something quieter than a notes app.',
    href: '/register',
    cta: 'Start writing',
    primary: false,
  },
  {
    id: 'quotes',
    icon: Quote,
    title: 'Quotes book',
    description:
      'A small library of lines for hard days. Browse, save the ones that hit, and come back when you need the words you couldn\'t find.',
    href: '/register',
    cta: 'Browse quotes',
    primary: false,
  },
]

function FeaturesBentoCard({ icon: Icon, title, description, href, cta, primary = false }) {
  return (
    <Link
      href={href}
      className={`pss-features-bento__card${primary ? ' pss-features-bento__card--primary' : ''}`}
    >
      <span className="pss-features-bento__icon" aria-hidden>
        <Icon className="w-6 h-6 text-primary" strokeWidth={1.75} />
      </span>
      <h3 className="pss-features-bento__title font-serif">{title}</h3>
      <p className="pss-features-bento__desc">{description}</p>
      <span className="pss-features-bento__cta">{cta} →</span>
    </Link>
  )
}

function Features() {
  const [primary, ...secondary] = LANDING_FEATURES

  return (
    <section id="features" className="pss-features-section px-6 md:px-12 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <SectionEyebrow>Features</SectionEyebrow>
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight">
            Everything in your <span className="italic">private space</span>
          </h2>
          <p className="pss-features-section__intro mt-4 text-muted-foreground text-base md:text-lg">
            Tools built for heartbreak — comfort first, pressure never.
          </p>
        </div>

        <MobileScrollSwap
          items={LANDING_FEATURES}
          trackClassName="pss-scroll-swap--features"
          renderItem={(feature) => (
            <FeaturesBentoCard {...feature} />
          )}
        />

        <div className="pss-features-bento pss-features-bento--desktop">
          <FeaturesBentoCard {...primary} />
          <div className="pss-features-bento__row">
            {secondary.map((feature) => (
              <FeaturesBentoCard key={feature.id} {...feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const COMPANION_MODES = [
  {
    id: 'emotional',
    label: 'Emotional',
    icon: Heart,
    blurb: 'Hold-me-while-I-cry mode. Pure comfort, no fixing.',
    modeTag: 'Emotional mode',
    messages: [
      { role: 'assistant', text: "Hey. Whatever brought you here — I'm glad you came. What's weighing on you?" },
      { role: 'user', text: "I can't stop crying and I don't even know why anymore." },
      { role: 'assistant', text: "You don't need a reason. Some grief doesn't have words yet — and that's okay. I'm right here." },
    ],
  },
  {
    id: 'logical',
    label: 'Logical',
    icon: Brain,
    blurb: 'Help me see this clearly. Patterns, perspective, truth.',
    modeTag: 'Logical mode',
    messages: [
      { role: 'assistant', text: "Tell me what happened — the version you haven't edited for anyone else." },
      { role: 'user', text: 'They said they needed space but they were already halfway out the door.' },
      { role: 'assistant', text: "That's a hard thing to sit with. What part of that feels most true to you right now?" },
    ],
  },
  {
    id: 'vent',
    label: 'Venting',
    icon: Volume2,
    blurb: 'Unfiltered. I just listen. No advice, no judgment.',
    modeTag: 'Vent mode',
    messages: [
      { role: 'user', text: "I'm so angry I could scream and I hate that I still miss them." },
      { role: 'assistant', text: "Both can be true at once. You don't have to pick one feeling to be valid." },
    ],
  },
  {
    id: 'talk',
    label: 'Just talking',
    icon: Coffee,
    blurb: 'Casual company when the silence gets too loud.',
    modeTag: 'Just talking',
    messages: [
      { role: 'assistant', text: 'the thing about rewatching comfort shows after a breakup is they hit different every time.' },
      { role: 'user', text: 'yeah i put on the same movie three nights in a row' },
      { role: 'assistant', text: "some nights you need the plot you already know. what did you put on?" },
    ],
  },
  {
    id: 'stop_contact',
    label: 'Stop me from texting them',
    icon: PhoneOff,
    blurb: "Hand me your phone. I'll talk you off the ledge.",
    modeTag: 'Stop-contact mode',
    messages: [
      { role: 'assistant', text: 'Good call coming here first. What were you going to say to them?' },
      { role: 'user', text: 'I just wanted to know if they think about me at all.' },
      { role: 'assistant', text: "What do you think you'd feel if they answered — honestly?" },
    ],
  },
  {
    id: 'cross',
    label: 'Cross-mode',
    icon: GitBranch,
    blurb: 'I read the room and switch as you do. No picking required.',
    modeTag: 'Cross-mode',
    messages: [
      { role: 'user', text: "Part of me knows it's over. Part of me still hopes they'll come back." },
      { role: 'assistant', text: "Both parts deserve airtime. You don't have to resolve that tonight — just notice which one is louder right now." },
    ],
  },
]

function CompanionModeCard({ mode, active, onSelect, as = 'button' }) {
  const Icon = mode.icon
  const className = `pss-companion-mode${active ? ' pss-companion-mode--active' : ''}`

  const inner = (
    <>
      <span className="pss-companion-mode__icon" aria-hidden>
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </span>
      <span className="pss-companion-mode__body">
        <span className="pss-companion-mode__label">{mode.label}</span>
        <span className="pss-companion-mode__blurb">{mode.blurb}</span>
      </span>
    </>
  )

  if (as === 'div') {
    return <div className={`${className} pss-companion-mode--static`}>{inner}</div>
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={className}
      onClick={onSelect}
    >
      {inner}
    </button>
  )
}

function CompanionMobileModes() {
  const reduceMotion = useReducedMotion()

  return (
    <div className="pss-companion-mobile">
      <div className="pss-companion-mobile__preview">
        <CompanionPreview mode={COMPANION_MODES[0]} />
      </div>
      <div className="pss-companion-mobile__modes">
        {COMPANION_MODES.map((mode, index) => (
          <motion.div
            key={mode.id}
            className="pss-companion-mobile__mode-wrap"
            initial={reduceMotion ? false : { opacity: 0, x: index % 2 === 0 ? -56 : 56 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35, margin: '-40px' }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <CompanionModeCard mode={mode} active={index === 0} as="div" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function CompanionPreview({ mode }) {
  return (
    <div className="pss-companion-preview">
      <div className="pss-companion-preview__header">
        <div className="pss-companion-preview__brand">
          <span className="pss-companion-preview__avatar" aria-hidden>
            <Heart className="w-4 h-4 text-primary" />
          </span>
          <div>
            <div className="pss-companion-preview__name">parlé</div>
            <div className="pss-companion-preview__status">
              <span className="pss-companion-preview__dot" aria-hidden />
              {mode.modeTag} · Always here for you
            </div>
          </div>
        </div>
        <div className="pss-companion-preview__lock">
          <Lock className="w-3 h-3" strokeWidth={2} aria-hidden />
          <span>Encrypted at rest</span>
        </div>
      </div>

      <div className="pss-companion-preview__thread">
        {mode.messages.map((msg, index) => (
          <div
            key={`${mode.id}-${index}`}
            className={
              msg.role === 'user'
                ? 'pss-companion-preview__bubble pss-companion-preview__bubble--user'
                : 'pss-companion-preview__bubble pss-companion-preview__bubble--ai'
            }
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className="pss-companion-preview__input" aria-hidden>
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <span>Share what&apos;s on your mind...</span>
      </div>

      <div className="pss-companion-preview__footer">
        <span>Memory off</span>
        <span className="pss-companion-preview__footer-sep" aria-hidden>·</span>
        <span>Guest · Device-only</span>
      </div>
    </div>
  )
}

function Companion() {
  const [activeId, setActiveId] = useState('emotional')
  const activeMode = COMPANION_MODES.find((m) => m.id === activeId) || COMPANION_MODES[0]

  return (
    <section id="companion" className="pss-companion-section px-6 md:px-12 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <SectionEyebrow>The companion</SectionEyebrow>
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight">
            One chatbot. <span className="italic text-primary">Six ways</span> to show up for you.
          </h2>
          <p className="mt-4 text-muted-foreground text-base md:text-lg">
            Heartbreak isn&apos;t one feeling. Pick the mode that matches the moment — or let it read you and adapt.
          </p>
        </div>

        <div className="pss-companion-layout pss-companion-layout--desktop mt-12 md:mt-16">
          <div className="pss-companion-modes" role="tablist" aria-label="Chat modes">
            {COMPANION_MODES.map((mode) => (
              <CompanionModeCard
                key={mode.id}
                mode={mode}
                active={mode.id === activeId}
                onSelect={() => setActiveId(mode.id)}
              />
            ))}
          </div>

          <div className="pss-companion-preview-wrap" role="tabpanel" aria-label={`${activeMode.label} preview`}>
            <CompanionPreview mode={activeMode} />
          </div>
        </div>

        <CompanionMobileModes />

        <p className="pss-companion-cta text-center mt-10">
          <Link href="/chat" className="pss-hero-btn pss-hero-btn--primary">
            Start talking
          </Link>
        </p>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section id="talk" className="px-6 md:px-12 py-24 pss-section-cta text-center">
      <h2 className="font-serif text-4xl md:text-6xl">Need someone right now?</h2>
      <p className="mt-4 text-muted-foreground">Start with one option that matches how you feel — then talk.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/chat"
          className="bg-primary text-primary-foreground rounded-full px-8 py-4 font-medium hover:opacity-90 transition"
        >
          Start talking
        </Link>
        <Link
          href="/register"
          className="bg-card border border-border rounded-full px-8 py-4 font-medium hover:bg-secondary transition"
        >
          Create an account
        </Link>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-primary" /> Free to start
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-primary" /> No credit card
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-primary" /> Private by default
        </span>
      </div>
    </section>
  )
}

export default function ParlerLandingPage({ signupDeclined = false }) {
  return (
    <main className="parler-landing min-h-screen bg-background text-foreground">
      <MarketingNav />
      {signupDeclined ? (
        <div className="px-6 md:px-10 py-3 bg-accent/40 border-b border-border/40 text-sm text-center" role="status">
          You chose not to accept the Terms &amp; Safety Agreement, so account creation is not available.{' '}
          <Link href="/register" className="text-primary underline underline-offset-2">
            Review the agreement
          </Link>{' '}
          when you are ready.
        </div>
      ) : null}
      <DictionaryHero />
      <WhatIsParle />
      <WhyParle />
      <Features />
      <Companion />
      <VerticalTestimonialsSpin />
      <CTA />
      <footer className="pss-landing-footer px-6 md:px-12 py-10 text-center text-sm text-muted-foreground">
        <p className="pss-landing-footer__tagline">
          <span className="pss-landing-footer__wordmark font-serif italic text-lg text-foreground">parlé</span>
          {' · '}A quiet space, always open.
        </p>
        <p className="pss-landing-footer__links">
          <Link href="/terms" className="text-primary hover:underline">
            Terms &amp; Safety
          </Link>
          {' · '}
          <Link href="/contact" className="text-primary hover:underline">
            Contact
          </Link>
        </p>
      </footer>
    </main>
  )
}
