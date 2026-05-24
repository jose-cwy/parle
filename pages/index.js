import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion'
import dynamic from 'next/dynamic'
import { spring } from '../lib/motion'

// Three.js is not SSR-compatible — load client-side only
const RoomScene = dynamic(() => import('../components/RoomScene'), { ssr: false })

/* ─── Feature panel data ────────────────────────────────────── */
const features = [
  {
    id: 'letter',
    eyebrow: 'The first step',
    title: 'Write a letter to yourself.',
    body: 'Sit at the warm desk. Write what you cannot yet say out loud. Seal it until you are ready to read it back.',
    href: '/letter-to-yourself',
    link: 'Open Letters',
    side: 'left',
    demo: {
      type: 'letter',
      lines: ['Dear future me,', 'Today was hard.', 'I do not know where', 'this feeling ends...'],
    },
  },
  {
    id: 'diary',
    eyebrow: 'A page for today',
    title: 'Keep a private diary.',
    body: 'Every day is a new page. Track what happened, how you felt, and what you need next — no one else can read this.',
    href: '/diary',
    link: 'Open Diary',
    side: 'right',
    demo: {
      type: 'diary',
      lines: ['May 24 — I cried again today.', 'But I also laughed.', 'That feels like progress.'],
    },
  },
  {
    id: 'chat',
    eyebrow: 'Not alone',
    title: 'Talk it out with someone who listens.',
    body: 'Heartstrings AI is calm, patient, and always present. It remembers your story and never judges.',
    href: '/chat',
    link: 'Open Chat',
    side: 'left',
    demo: {
      type: 'chat',
      messages: [
        { role: 'user', text: 'I keep thinking about them.' },
        { role: 'ai', text: 'That is really hard. What do those thoughts feel like for you right now?' },
        { role: 'user', text: 'Like a song stuck in my head.' },
      ],
    },
  },
  {
    id: 'quotes',
    eyebrow: 'Words that stay',
    title: 'Find the quote that reaches you.',
    body: 'A library of quotes sorted by heartbreak, healing, and self-love. Bookmark the ones that feel written for right now.',
    href: '/quotes',
    link: 'Browse Quotes',
    side: 'right',
    demo: {
      type: 'quotes',
      items: [
        'You are allowed to be both a masterpiece and a work in progress.',
        'The wound is the place where the light enters you.',
      ],
    },
  },
]

/* Scroll range per phase — 500vh / 5 segments */
const PHASES = [
  [0, 0.18],   // hero reveal
  [0.18, 0.36], // letter
  [0.36, 0.54], // diary
  [0.54, 0.72], // chat
  [0.72, 0.88], // quotes
  [0.88, 1.0],  // CTA
]

/* ─── Typewriter hook ───────────────────────────────────────── */
function useTypewriter(text, active, speed = 38) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!active) { setDisplayed(''); return }
    let i = 0
    setDisplayed('')
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, speed)
    return () => clearInterval(interval)
  }, [text, active, speed])
  return displayed
}

/* ─── Feature demo snippets ─────────────────────────────────── */
function LetterDemo({ lines }) {
  return (
    <div className="panel-demo panel-demo-letter mt-4">
      {lines.map((l, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, ...spring.gentle }}
        >
          {l}
        </motion.p>
      ))}
      <motion.span
        className="typewriter-cursor"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </div>
  )
}

function ChatDemo({ messages }) {
  return (
    <div className="panel-demo panel-demo-chat mt-4">
      {messages.map((m, i) => (
        <motion.div
          key={i}
          className={`panel-chat-bubble ${m.role === 'user' ? 'panel-chat-user' : 'panel-chat-ai'}`}
          initial={{ opacity: 0, y: 8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.22, ...spring.snappy }}
        >
          {m.text}
        </motion.div>
      ))}
    </div>
  )
}

function QuotesDemo({ items }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {items.map((q, i) => (
        <motion.blockquote
          key={i}
          className="room-panel-body italic border-l-2 border-[var(--accent)] pl-4 !mb-0 text-sm"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15, ...spring.gentle }}
        >
          &ldquo;{q}&rdquo;
        </motion.blockquote>
      ))}
    </div>
  )
}

function DiaryDemo({ lines }) {
  return (
    <div className="panel-demo panel-demo-letter mt-4">
      {lines.map((l, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.12, ...spring.gentle }}
        >
          {l}
        </motion.p>
      ))}
    </div>
  )
}

/* ─── Single feature panel positioned over the room ─────────── */
function FeaturePanel({ feature, visible }) {
  const isLeft = feature.side === 'left'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={feature.id}
          className="room-panel"
          style={{
            [isLeft ? 'left' : 'right']: 'clamp(1.5rem, 5vw, 5rem)',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
          initial={{ opacity: 0, x: isLeft ? -72 : 72, filter: 'blur(14px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: isLeft ? -40 : 40, filter: 'blur(8px)' }}
          transition={{ ...spring.float, opacity: { duration: 0.5 } }}
        >
          <span className="room-panel-eyebrow">{feature.eyebrow}</span>
          <h2 className="room-panel-title">{feature.title}</h2>
          <p className="room-panel-body">{feature.body}</p>

          {feature.demo.type === 'letter' && <LetterDemo lines={feature.demo.lines} />}
          {feature.demo.type === 'chat' && <ChatDemo messages={feature.demo.messages} />}
          {feature.demo.type === 'quotes' && <QuotesDemo items={feature.demo.items} />}
          {feature.demo.type === 'diary' && <DiaryDemo lines={feature.demo.lines} />}

          <Link href={feature.href} className="room-panel-link mt-5 inline-flex">
            {feature.link} →
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─── Scroll journey thread ─────────────────────────────────── */
function ScrollThread({ scrollYProgress }) {
  const height = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])
  const NODES = [0, 0.18, 0.36, 0.54, 0.72, 0.90]

  return (
    <div
      style={{
        position: 'fixed',
        left: '1.5rem',
        top: 0,
        bottom: 0,
        width: 2,
        zIndex: 50,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {/* Faint rail */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(232,168,96,0.1)',
          borderRadius: 2,
        }}
      />
      {/* Growing amber thread */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height,
          background: 'linear-gradient(to bottom, var(--accent), var(--accent-2))',
          borderRadius: 2,
          boxShadow: '0 0 8px 2px rgba(232,168,96,0.4)',
        }}
      />
      {/* Phase nodes */}
      {NODES.map((p, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: `${p * 100}%`,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: '1.5px solid rgba(13,10,8,0.8)',
          }}
          animate={{ opacity: [0.35, 0.75, 0.35], scale: [0.9, 1.2, 0.9] }}
          transition={{
            duration: 2.8 + i * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.4,
          }}
        />
      ))}
    </div>
  )
}

/* ─── Progress dots ─────────────────────────────────────────── */
function NavDots({ activePhase, count = 6, onDotClick }) {
  return (
    <div className="room-nav-dots" aria-hidden="true">
      {[...Array(count)].map((_, i) => (
        <button
          key={i}
          className={`room-nav-dot ${activePhase === i ? 'active' : ''}`}
          onClick={() => onDotClick(i)}
          tabIndex={-1}
        />
      ))}
    </div>
  )
}

/* ─── Scroll progress bar ───────────────────────────────────── */
function ScrollProgressBar({ scrollYProgress }) {
  return (
    <motion.div
      className="journey-progress-bar"
      style={{ scaleX: scrollYProgress, width: '100%' }}
    />
  )
}

/* ─── Main page ─────────────────────────────────────────────── */
export default function Home() {
  const stageRef = useRef(null)
  const shouldReduceMotion = useReducedMotion()

  /* Scroll tracking on the outer 500vh div */
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end end'],
  })

  /* Entry animation state */
  const [entryDone, setEntryDone] = useState(false)
  const [darkOverlay, setDarkOverlay] = useState(true)
  const [heroActive, setHeroActive] = useState(false)
  const [activePhase, setActivePhase] = useState(0)

  /* Drive active phase from scroll */
  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      for (let i = PHASES.length - 1; i >= 0; i--) {
        if (v >= PHASES[i][0]) {
          setActivePhase(i)
          break
        }
      }
    })
    return unsub
  }, [scrollYProgress])

  /* Cinematic entry sequence on mount */
  useEffect(() => {
    if (shouldReduceMotion) {
      setDarkOverlay(false)
      setHeroActive(true)
      setEntryDone(true)
      return
    }

    const t1 = setTimeout(() => setDarkOverlay(false), 300)
    const t2 = setTimeout(() => setHeroActive(true), 1200)
    const t3 = setTimeout(() => setEntryDone(true), 3200)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [shouldReduceMotion])

  /* Typewriter headline */
  const headline = useTypewriter(
    'A warm room for healing when love hurts.',
    heroActive,
    42,
  )

  /* Scroll to phase via dot click */
  const scrollToPhase = (i) => {
    if (!stageRef.current) return
    const totalHeight = stageRef.current.scrollHeight - window.innerHeight
    const targetY = stageRef.current.offsetTop + (PHASES[i][0] + 0.01) * totalHeight
    window.scrollTo({ top: targetY, behavior: 'smooth' })
  }

  /* Is a given feature phase visible? */
  const isFeatureVisible = (idx) => activePhase === idx + 1

  return (
    <>
      <ScrollProgressBar scrollYProgress={scrollYProgress} />
      <ScrollThread scrollYProgress={scrollYProgress} />

      <div ref={stageRef} className="room-stage">
        {/* ── STICKY ROOM VIEWPORT ── */}
        <div className="room-sticky">

          {/* Three.js room scene — full bleed, scroll-driven camera */}
          <RoomScene scrollProgress={scrollYProgress} />

          {/* ── Cinematic darkness — fades out on entry ── */}
          <AnimatePresence>
            {darkOverlay && (
              <motion.div
                className="room-entry-dark"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </AnimatePresence>

          {/* ── PHASE 0: Hero content (typewriter headline) ── */}
          <AnimatePresence>
            {activePhase === 0 && (
              <motion.div
                key="hero"
                className="room-hero-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.p
                  className="room-panel-eyebrow mb-3"
                  initial={{ opacity: 0, y: 14 }}
                  animate={heroActive ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.2, ...spring.gentle }}
                >
                  Heartstrings Club
                </motion.p>

                <h1 className="room-hero-headline">
                  {headline}
                  <span className="typewriter-cursor" aria-hidden="true" />
                </h1>

                <motion.p
                  className="room-hero-sub"
                  initial={{ opacity: 0, y: 14 }}
                  animate={heroActive ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 2.6, ...spring.gentle }}
                >
                  Scroll to enter.
                </motion.p>

                <motion.div
                  className="scroll-hint"
                  initial={{ opacity: 0 }}
                  animate={heroActive ? { opacity: 1 } : {}}
                  transition={{ delay: 3.2, duration: 1 }}
                >
                  <span className="scroll-hint-text">scroll to journey</span>
                  <motion.div
                    style={{ width: 1, height: 36, background: 'rgba(255,244,232,0.22)', borderRadius: 2 }}
                    animate={{ scaleY: [0, 1, 0], opacity: [0, 0.55, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASES 1-4: Feature panels ── */}
          {features.map((feat, i) => (
            <FeaturePanel
              key={feat.id}
              feature={feat}
              visible={isFeatureVisible(i)}
            />
          ))}

          {/* ── PHASE 5: CTA ── */}
          <AnimatePresence>
            {activePhase === 5 && (
              <motion.div
                key="cta"
                className="room-cta-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.p
                  className="room-panel-eyebrow mb-3"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, ...spring.gentle }}
                >
                  The door is open
                </motion.p>

                <motion.h2
                  style={{
                    fontFamily: 'var(--font-serif), Georgia, serif',
                    fontSize: 'clamp(2rem, 5vw, 4rem)',
                    fontWeight: 700,
                    lineHeight: 1.15,
                    color: 'var(--paper-bg)',
                    letterSpacing: '-0.025em',
                    textShadow: '0 4px 24px rgba(0,0,0,0.45)',
                    marginBottom: '1.25rem',
                  }}
                  initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.3, ...spring.float }}
                >
                  Your room is ready.
                </motion.h2>

                <motion.p
                  style={{
                    color: 'rgba(255,244,232,0.68)',
                    fontSize: '1.05rem',
                    maxWidth: 480,
                    lineHeight: 1.7,
                    margin: '0 auto 2.25rem',
                  }}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, ...spring.gentle }}
                >
                  Come back as often as you need. No pressure, no timeline — only warmth, privacy, and the quiet space to feel your way through.
                </motion.p>

                <motion.div
                  className="flex flex-wrap gap-3 justify-center"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, ...spring.gentle }}
                >
                  <Link href="/register" className="room-cta-join-btn">
                    Join the club
                  </Link>
                  <Link
                    href="/login"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.95rem 1.8rem',
                      borderRadius: 99,
                      border: '1.5px solid rgba(255,244,232,0.22)',
                      color: 'rgba(255,244,232,0.75)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'border-color 0.2s, color 0.2s',
                    }}
                  >
                    Already have a space
                  </Link>
                </motion.div>

                {/* Twinkling fairy lights */}
                <motion.div
                  className="flex justify-center items-center gap-5 mt-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.8 }}
                  aria-hidden="true"
                >
                  {[0, 0.4, 0.8, 1.2, 0.6, 1.0].map((d, i) => (
                    <motion.span
                      key={i}
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: i % 2 === 0 ? 'var(--accent)' : 'var(--accent-teal)',
                        boxShadow: `0 0 14px 4px ${i % 2 === 0 ? 'rgba(232,168,96,0.5)' : 'rgba(74,138,130,0.5)'}`,
                      }}
                      animate={{ opacity: [0.3, 1, 0.4], scale: [0.85, 1.2, 0.9] }}
                      transition={{ duration: 2.2 + d, repeat: Infinity, ease: [0.22, 1, 0.36, 1], delay: d }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase label (small bottom-centre indicator) */}
          <AnimatePresence mode="wait">
            {activePhase > 0 && activePhase < 5 && (
              <motion.div
                key={`label-${activePhase}`}
                style={{
                  position: 'absolute',
                  bottom: '1.75rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 35,
                  fontSize: '0.68rem',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,244,232,0.32)',
                  fontWeight: 500,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
              >
                {features[activePhase - 1]?.eyebrow}
              </motion.div>
            )}
          </AnimatePresence>

          <NavDots activePhase={activePhase} count={6} onDotClick={scrollToPhase} />
        </div>
      </div>
    </>
  )
}
