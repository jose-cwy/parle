import Link from 'next/link'
import { useRef, useState, useEffect, useCallback } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion'
import dynamic from 'next/dynamic'
import { spring } from '../lib/motion'

/* ease-out-expo for all panel entrances */
const EXPO = [0.16, 1, 0.3, 1]

/* ConstellationScene — Canvas-based 3D star field, no Three.js */
const ConstellationScene = dynamic(() => import('../components/ConstellationScene'), { ssr: false })

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

/* ─── CTA Particles — pure CSS, seeded positions ────────────── */
const PARTICLES = (() => {
  function sr(seed) {
    let s = seed
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      return (s >>> 0) / 0xffffffff
    }
  }
  const rand = sr(0xabc123)
  return Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: `${10 + rand() * 80}%`,
    bottom: `${5 + rand() * 35}%`,
    size: 4 + rand() * 5,
    dur: `${3 + rand() * 3.5}s`,
    delay: `${rand() * 4}s`,
    color: rand() > 0.5 ? 'var(--accent)' : 'var(--accent-2)',
  }))
})()

/* ─── Typewriter hook ───────────────────────────────────────── */
function useTypewriter(text, active, speed = 36) {
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
    <div className="panel-demo panel-demo-letter mt-3">
      {lines.map((l, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, duration: 0.5, ease: EXPO }}
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
    <div className="panel-demo panel-demo-chat mt-3">
      {messages.map((m, i) => (
        <motion.div
          key={i}
          className={`panel-chat-bubble ${m.role === 'user' ? 'panel-chat-user' : 'panel-chat-ai'}`}
          initial={{ opacity: 0, y: 10, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.2, duration: 0.5, ease: EXPO }}
        >
          {m.text}
        </motion.div>
      ))}
    </div>
  )
}

function QuotesDemo({ items }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {items.map((q, i) => (
        <motion.blockquote
          key={i}
          className="room-panel-body italic border-l-2 pl-3 !mb-0 text-sm"
          style={{ borderColor: 'var(--accent)' }}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15, duration: 0.5, ease: EXPO }}
        >
          &ldquo;{q}&rdquo;
        </motion.blockquote>
      ))}
    </div>
  )
}

function DiaryDemo({ lines }) {
  return (
    <div className="panel-demo panel-demo-letter mt-3">
      {lines.map((l, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.12, duration: 0.5, ease: EXPO }}
        >
          {l}
        </motion.p>
      ))}
    </div>
  )
}

/* ─── Feature panel — staggered entrance with ease-out-expo ─── */
function FeaturePanel({ feature, visible }) {
  const isLeft = feature.side === 'left'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={feature.id}
          className="room-panel"
          style={{
            [isLeft ? 'left' : 'right']: 'clamp(1.25rem, 4vw, 4.5rem)',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
          initial={{ opacity: 0, x: isLeft ? -64 : 64, filter: 'blur(16px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: isLeft ? -32 : 32, filter: 'blur(8px)', transition: { duration: 0.32, ease: [0.45, 0, 0.2, 1] } }}
          transition={{ duration: 0.7, ease: EXPO, opacity: { duration: 0.45 } }}
        >
          <motion.span
            className="room-panel-eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.5, ease: EXPO }}
          >
            {feature.eyebrow}
          </motion.span>

          <motion.h2
            className="room-panel-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.55, ease: EXPO }}
          >
            {feature.title}
          </motion.h2>

          <motion.p
            className="room-panel-body"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.5, ease: EXPO }}
          >
            {feature.body}
          </motion.p>

          {feature.demo.type === 'letter' && <LetterDemo lines={feature.demo.lines} />}
          {feature.demo.type === 'chat' && <ChatDemo messages={feature.demo.messages} />}
          {feature.demo.type === 'quotes' && <QuotesDemo items={feature.demo.items} />}
          {feature.demo.type === 'diary' && <DiaryDemo lines={feature.demo.lines} />}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.45, ease: EXPO }}
          >
            <Link href={feature.href} className="room-panel-link mt-4 inline-flex">
              {feature.link} →
            </Link>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ─── CurvedTrail — Canvas cubic bezier dotted path ─────────── */
function CurvedTrail({ scrollYProgress }) {
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const progress = scrollYProgress.get()

    ctx.clearRect(0, 0, W, H)

    /* Build a smooth cubic bezier S-curve through the canvas height */
    const cx = W / 2
    /* Control points for the S-curve — weave left/right */
    const points = [
      { x: cx,       y: 0 },
      { x: W * 0.12, y: H * 0.25 },
      { x: W * 0.88, y: H * 0.5 },
      { x: cx,       y: H },
    ]

    /* Create a temporary offscreen path to measure total length */
    const totalDots = Math.floor(H / 14)
    const filledDots = Math.round(totalDots * progress)

    for (let i = 0; i < totalDots; i++) {
      const t = i / (totalDots - 1)
      /* Cubic bezier interpolation */
      const x = cubicBezier(points[0].x, points[1].x, points[2].x, points[3].x, t)
      const y = cubicBezier(points[0].y, points[1].y, points[2].y, points[3].y, t)

      if (i < filledDots) {
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(45,212,191,${0.55 + 0.45 * (i / totalDots)})`
        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(45,212,191,0.6)'
        ctx.fill()
        ctx.shadowBlur = 0
      } else {
        ctx.beginPath()
        ctx.arc(x, y, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(45,212,191,0.12)'
        ctx.fill()
      }
    }
  }, [scrollYProgress])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width  = 48
      canvas.height = window.innerHeight
      draw()
    }
    resize()
    window.addEventListener('resize', resize)

    const unsub = scrollYProgress.on('change', draw)
    return () => {
      window.removeEventListener('resize', resize)
      unsub()
    }
  }, [draw, scrollYProgress])

  return (
    <canvas
      ref={canvasRef}
      className="curved-trail-canvas"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 48,
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 50,
        display: 'block',
      }}
      aria-hidden="true"
    />
  )
}

function cubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
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

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end end'],
  })

  const [entryDone, setEntryDone]   = useState(false)
  const [darkOverlay, setDarkOverlay] = useState(true)
  const [heroActive, setHeroActive]  = useState(false)
  const [activePhase, setActivePhase] = useState(0)

  /* Drive active phase from scroll */
  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      for (let i = PHASES.length - 1; i >= 0; i--) {
        if (v >= PHASES[i][0]) { setActivePhase(i); break }
      }
    })
    return unsub
  }, [scrollYProgress])

  /* Cinematic entry sequence */
  useEffect(() => {
    if (shouldReduceMotion) {
      setDarkOverlay(false); setHeroActive(true); setEntryDone(true)
      return
    }
    const t1 = setTimeout(() => setDarkOverlay(false), 300)
    const t2 = setTimeout(() => setHeroActive(true), 1100)
    const t3 = setTimeout(() => setEntryDone(true), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [shouldReduceMotion])

  /* Typewriter headline */
  const headline = useTypewriter('A warm room for healing when love hurts.', heroActive, 40)

  /* Scroll to phase */
  const scrollToPhase = (i) => {
    if (!stageRef.current) return
    const totalHeight = stageRef.current.scrollHeight - window.innerHeight
    const targetY = stageRef.current.offsetTop + (PHASES[i][0] + 0.01) * totalHeight
    window.scrollTo({ top: targetY, behavior: 'smooth' })
  }

  const isFeatureVisible = (idx) => activePhase === idx + 1

  return (
    <>
      <ScrollProgressBar scrollYProgress={scrollYProgress} />
      <CurvedTrail scrollYProgress={scrollYProgress} />

      <div ref={stageRef} className="room-stage">
        <div className="room-sticky">

          {/* Constellation scene — Canvas 3D camera dolly */}
          <ConstellationScene scrollProgress={scrollYProgress} />

          {/* ── Cinematic darkness fade-in ── */}
          <AnimatePresence>
            {darkOverlay && (
              <motion.div
                className="room-entry-dark"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.6, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </AnimatePresence>

          {/* ── PHASE 0: Hero content ── */}
          <AnimatePresence>
            {activePhase === 0 && (
              <motion.div
                key="hero"
                className="room-hero-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -24, filter: 'blur(8px)' }}
                transition={{ duration: 0.55, ease: EXPO }}
              >
                <motion.p
                  className="room-panel-eyebrow mb-3"
                  initial={{ opacity: 0, y: 16 }}
                  animate={heroActive ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.1, duration: 0.55, ease: EXPO }}
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
                  transition={{ delay: 2.4, duration: 0.6, ease: EXPO }}
                >
                  Scroll to enter.
                </motion.p>

                <motion.div
                  className="scroll-hint"
                  initial={{ opacity: 0 }}
                  animate={heroActive ? { opacity: 1 } : {}}
                  transition={{ delay: 3.0, duration: 0.8 }}
                >
                  <span className="scroll-hint-text">scroll to journey</span>
                  <motion.div
                    style={{
                      width: 1,
                      height: 36,
                      background: 'rgba(45,212,191,0.35)',
                      borderRadius: 2,
                    }}
                    animate={{ scaleY: [0, 1, 0], opacity: [0, 0.7, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASES 1-4: Feature panels ── */}
          {features.map((feat, i) => (
            <FeaturePanel key={feat.id} feature={feat} visible={isFeatureVisible(i)} />
          ))}

          {/* ── PHASE 5: CTA with CSS particle burst ── */}
          <AnimatePresence>
            {activePhase === 5 && (
              <motion.div
                key="cta"
                className="room-cta-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: EXPO }}
              >
                {/* CSS particle burst — zero JS cost */}
                {PARTICLES.map((p) => (
                  <span
                    key={p.id}
                    className="cta-particle"
                    style={{
                      left: p.left,
                      bottom: p.bottom,
                      width: p.size,
                      height: p.size,
                      background: p.color,
                      '--dur': p.dur,
                      '--delay': p.delay,
                    }}
                  />
                ))}

                <motion.p
                  className="room-panel-eyebrow mb-3"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.55, ease: EXPO }}
                >
                  The door is open
                </motion.p>

                <motion.h2
                  style={{
                    fontFamily: 'var(--font-serif), Georgia, serif',
                    fontSize: 'clamp(2rem, 5vw, 4rem)',
                    fontWeight: 700,
                    lineHeight: 1.15,
                    color: 'var(--text)',
                    letterSpacing: '-0.025em',
                    textShadow: '0 4px 32px rgba(45,212,191,0.25), 0 2px 8px rgba(0,0,0,0.5)',
                    marginBottom: '1.25rem',
                  }}
                  initial={{ opacity: 0, y: 28, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.28, duration: 0.7, ease: EXPO }}
                >
                  Your room is ready.
                </motion.h2>

                <motion.p
                  style={{
                    color: 'rgba(184,224,232,0.72)',
                    fontSize: '1.05rem',
                    maxWidth: 480,
                    lineHeight: 1.7,
                    margin: '0 auto 2.25rem',
                  }}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.44, duration: 0.55, ease: EXPO }}
                >
                  Come back as often as you need. No pressure, no timeline — only warmth, privacy, and the quiet space to feel your way through.
                </motion.p>

                <motion.div
                  className="flex flex-wrap gap-3 justify-center"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.58, duration: 0.5, ease: EXPO }}
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
                      border: '1.5px solid rgba(45,212,191,0.28)',
                      color: 'rgba(184,224,232,0.82)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'border-color 0.2s, color 0.2s',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    Already have a space
                  </Link>
                </motion.div>

                {/* Twinkling teal lights */}
                <motion.div
                  className="flex justify-center items-center gap-4 mt-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.75, duration: 0.8 }}
                  aria-hidden="true"
                >
                  {[0, 0.4, 0.8, 1.2, 0.6, 1.0].map((d, i) => (
                    <motion.span
                      key={i}
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: i % 2 === 0 ? 'var(--accent)' : 'var(--accent-2)',
                        boxShadow: `0 0 14px 4px ${i % 2 === 0 ? 'rgba(45,212,191,0.55)' : 'rgba(56,189,248,0.5)'}`,
                      }}
                      animate={{ opacity: [0.25, 1, 0.35], scale: [0.8, 1.25, 0.85] }}
                      transition={{ duration: 2.2 + d, repeat: Infinity, ease: EXPO, delay: d }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase label */}
          <AnimatePresence mode="wait">
            {activePhase > 0 && activePhase < 5 && (
              <motion.div
                key={`label-${activePhase}`}
                style={{
                  position: 'absolute',
                  bottom: '1.5rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 35,
                  fontSize: '0.66rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(45,212,191,0.4)',
                  fontWeight: 500,
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
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
