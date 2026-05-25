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

/* ease-out-expo for all panel entrances */
const EXPO = [0.16, 1, 0.3, 1]

/* ConstellationScene — Canvas-based 3D star field, no Three.js */
const ConstellationScene = dynamic(() => import('../components/ConstellationScene'), { ssr: false })

/* ─── Feature panel data — Chat leads as the headline feature ── */
const features = [
  {
    id: 'chat',
    eyebrow: 'Not alone',
    title: 'Talk it out with someone who listens.',
    body: 'Heartstrings AI is calm, patient, and always present. It remembers your story and never judges.',
    href: '/chat',
    link: 'Open Chat',
    side: 'left',
    highlight: true,  // gives this card a teal outer glow
    badge: 'AI · Always here',
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
    id: 'letter',
    eyebrow: 'The first step',
    title: 'Write a letter to yourself.',
    body: 'Sit at the warm desk. Write what you cannot yet say out loud. Seal it until you are ready to read it back.',
    href: '/letter-to-yourself',
    link: 'Open Letters',
    side: 'right',
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
    side: 'left',
    demo: {
      type: 'diary',
      lines: ['May 24 — I cried again today.', 'But I also laughed.', 'That feels like progress.'],
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

/* Scroll range per phase — 8 segments across 700vh */
const PHASES = [
  [0,    0.12],  // 0: hero reveal
  [0.12, 0.22],  // 1: emotional quote
  [0.22, 0.36],  // 2: letter
  [0.36, 0.51],  // 3: diary
  [0.51, 0.66],  // 4: chat
  [0.66, 0.80],  // 5: quotes
  [0.80, 0.90],  // 6: testimonials
  [0.90, 1.0],   // 7: CTA
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

/*
 * Trail node positions — [x,y] as fraction of viewport (0–1).
 * S-curve from bottom-left to top, passing through each card's area.
 * Cards are at: letter (left, ~y 0.57), diary (right, ~y 0.40),
 *               chat (left, ~y 0.22), quotes (right, ~y 0.08).
 * Milestone indices: 2=letter, 5=diary, 7=chat, 9=quotes.
 */
const TRAIL_NODES = [
  [0.12, 0.96],  // 0 — start, bottom-left
  [0.20, 0.84],  // 1 — rising
  [0.24, 0.72],  // 2 ★ MILESTONE 0 — letter (left side)
  [0.32, 0.62],  // 3 — departing left
  [0.58, 0.55],  // 4 — sweeping right
  [0.72, 0.48],  // 5 ★ MILESTONE 1 — diary (right side)
  [0.62, 0.38],  // 6 — departing right
  [0.26, 0.30],  // 7 ★ MILESTONE 2 — chat (left side)
  [0.42, 0.20],  // 8 — rising
  [0.70, 0.14],  // 9 ★ MILESTONE 3 — quotes (right side)
  [0.48, 0.04],  // 10 — end, top center
]
const TRAIL_SEGMENT_COUNT = TRAIL_NODES.length - 1  // 10
const TRAIL_MILESTONES = new Set([2, 5, 7, 9])

/*
 * Card top positions matched to trail milestone y-values.
 * Indexed to features array (0=letter,1=diary,2=chat,3=quotes).
 */
const CARD_TOPS = ['57vh', '38vh', '20vh', '5vh']

/* ─── OceanTrail — full-screen scroll-drawn constellation trail ─── */
/*
 * Draws a proper constellation: straight lines between glowing star nodes.
 * All nodes are visible as faint ghost dots from the start — you can see
 * the full shape of the constellation waiting to be drawn in.
 * rAF-throttled: scroll value stored in a ref, one draw per animation frame.
 */
function OceanTrail({ scrollYProgress }) {
  const canvasRef  = useRef(null)
  const scrollRef  = useRef(0)
  const rafRef     = useRef(null)
  const sizeRef    = useRef({ W: 0, H: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    /* desynchronized hint reduces latency on supporting browsers */
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      sizeRef.current = { W: canvas.width, H: canvas.height }
      render(scrollRef.current)
    }

    const render = (progress) => {
      const { W, H } = sizeRef.current
      if (!W || !H) return
      ctx.clearRect(0, 0, W, H)

      const totalProgress = progress * TRAIL_SEGMENT_COUNT
      const fullSegs = Math.floor(totalProgress)
      const partial  = totalProgress - fullSegs

      const px = ([nx, ny]) => [nx * W, ny * H]

      /* 1. Ghost dots for ALL nodes — show the constellation shape ahead */
      for (let ni = 0; ni < TRAIL_NODES.length; ni++) {
        const [nx, ny] = px(TRAIL_NODES[ni])
        ctx.beginPath()
        ctx.arc(nx, ny, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = TRAIL_MILESTONES.has(ni)
          ? 'rgba(45,212,191,0.18)'
          : 'rgba(167,243,208,0.10)'
        ctx.fill()
      }

      /* 2. Completed segments — straight constellation lines */
      for (let s = 0; s < fullSegs && s < TRAIL_SEGMENT_COUNT; s++) {
        const [ax, ay] = px(TRAIL_NODES[s])
        const [bx, by] = px(TRAIL_NODES[s + 1])
        const ageAlpha = 0.25 + 0.45 * (s / TRAIL_SEGMENT_COUNT)

        const grad = ctx.createLinearGradient(ax, ay, bx, by)
        grad.addColorStop(0,   `rgba(45,212,191,${(ageAlpha * 0.6).toFixed(2)})`)
        grad.addColorStop(0.5, `rgba(56,189,248,${ageAlpha.toFixed(2)})`)
        grad.addColorStop(1,   `rgba(167,243,208,${(ageAlpha * 0.8).toFixed(2)})`)

        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.strokeStyle = grad
        ctx.lineWidth   = 1.2
        ctx.stroke()
      }

      /* 3. Currently-drawing partial segment — comet drawing toward next node */
      if (fullSegs < TRAIL_SEGMENT_COUNT && partial > 0.005) {
        const [ax, ay] = px(TRAIL_NODES[fullSegs])
        const [bx, by] = px(TRAIL_NODES[fullSegs + 1])
        const ex = ax + (bx - ax) * partial
        const ey = ay + (by - ay) * partial

        const grad = ctx.createLinearGradient(ax, ay, ex, ey)
        grad.addColorStop(0,   'rgba(45,212,191,0.08)')
        grad.addColorStop(0.6, 'rgba(56,189,248,0.60)')
        grad.addColorStop(1,   'rgba(200,252,245,0.96)')

        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ex, ey)
        ctx.strokeStyle = grad
        ctx.lineWidth   = 1.6
        ctx.shadowBlur  = 7
        ctx.shadowColor = 'rgba(45,212,191,0.65)'
        ctx.stroke()
        ctx.shadowBlur  = 0

        /* Comet head */
        ctx.beginPath()
        ctx.arc(ex, ey, 2.6, 0, Math.PI * 2)
        ctx.fillStyle   = 'rgba(200,255,245,0.95)'
        ctx.shadowBlur  = 12
        ctx.shadowColor = 'rgba(45,212,191,0.8)'
        ctx.fill()
        ctx.shadowBlur  = 0
      }

      /* 4. Bloom arrived nodes */
      const arrivedCount = Math.min(fullSegs + 1, TRAIL_NODES.length)
      for (let ni = 0; ni < arrivedCount; ni++) {
        const [nx, ny] = px(TRAIL_NODES[ni])
        const isMile   = TRAIL_MILESTONES.has(ni)
        const bloomR   = isMile ? 22 : 8
        const dotR     = isMile ? 3.8 : 2.2
        const bloomA   = isMile ? 0.55 : 0.30

        const bloom = ctx.createRadialGradient(nx, ny, 0, nx, ny, bloomR)
        bloom.addColorStop(0, `rgba(45,212,191,${bloomA})`)
        bloom.addColorStop(1, 'rgba(45,212,191,0)')
        ctx.beginPath()
        ctx.arc(nx, ny, bloomR, 0, Math.PI * 2)
        ctx.fillStyle = bloom
        ctx.fill()

        ctx.beginPath()
        ctx.arc(nx, ny, dotR, 0, Math.PI * 2)
        ctx.fillStyle   = isMile ? 'rgba(200,255,245,0.95)' : 'rgba(167,243,208,0.85)'
        ctx.shadowBlur  = isMile ? 14 : 5
        ctx.shadowColor = 'rgba(45,212,191,0.75)'
        ctx.fill()
        ctx.shadowBlur  = 0

        if (isMile) {
          ctx.beginPath()
          ctx.arc(nx, ny, bloomR * 0.60, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(56,189,248,0.28)'
          ctx.lineWidth   = 1.1
          ctx.stroke()
        }
      }
    }

    /* rAF throttle: at most one draw per animation frame */
    const scheduleDraw = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        render(scrollRef.current)
      })
    }

    resize()
    window.addEventListener('resize', resize)
    const unsub = scrollYProgress.on('change', v => {
      scrollRef.current = v
      scheduleDraw()
    })
    return () => {
      window.removeEventListener('resize', resize)
      unsub()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [scrollYProgress])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 32,
      }}
    />
  )
}

/* ─── Feature panel — bursts from trail milestone node ─── */
function FeaturePanel({ feature, idx, visible }) {
  const isLeft = feature.side === 'left'
  const cardTop = CARD_TOPS[idx]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={feature.id}
          className="room-panel"
          style={{
            [isLeft ? 'left' : 'right']: 'clamp(1.25rem, 4vw, 4.5rem)',
            top: cardTop,
            transformOrigin: isLeft ? 'left center' : 'right center',
            /* Teal outer glow for the highlighted (chat) card */
            ...(feature.highlight && {
              boxShadow: '0 0 48px rgba(45,212,191,0.18), 0 0 0 1px rgba(45,212,191,0.22)',
            }),
          }}
          initial={{ opacity: 0, scale: 0.04, filter: 'blur(28px)' }}
          animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.88, filter: 'blur(12px)', transition: { duration: 0.28, ease: [0.45, 0, 0.2, 1] } }}
          transition={{ type: 'spring', stiffness: 180, damping: 20, mass: 1.1, opacity: { duration: 0.3 } }}
        >
          {/* Eyebrow row — badge sits inline for highlighted card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <motion.span
              className="room-panel-eyebrow"
              style={{ margin: 0 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.5, ease: EXPO }}
            >
              {feature.eyebrow}
            </motion.span>
            {feature.badge && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.18, duration: 0.4, ease: EXPO }}
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  background: 'rgba(45,212,191,0.16)',
                  color: 'var(--accent-teal)',
                  border: '1px solid rgba(45,212,191,0.32)',
                  borderRadius: '999px',
                  padding: '0.12em 0.6em',
                  whiteSpace: 'nowrap',
                }}
              >
                {feature.badge}
              </motion.span>
            )}
          </div>

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
          {feature.demo.type === 'chat'   && <ChatDemo messages={feature.demo.messages} />}
          {feature.demo.type === 'quotes' && <QuotesDemo items={feature.demo.items} />}
          {feature.demo.type === 'diary'  && <DiaryDemo lines={feature.demo.lines} />}

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

/* ─── DriftParticles — slow upward-drifting firefly particles ── */
/*
 * 18 tiny glowing dots seeded at fixed positions across the viewport.
 * Each drifts upward slowly and fades in-out like fireflies / embers.
 * Color mix: silver-white and soft teal.
 * Respects prefers-reduced-motion — renders nothing when reduced.
 */
const DRIFT_PARTICLES = (() => {
  function sr(seed) {
    let s = seed
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff
      return (s >>> 0) / 0xffffffff
    }
  }
  const rand = sr(0xf1be50)
  return Array.from({ length: 10 }, (_, i) => ({
    id: i,
    left: `${4 + rand() * 88}%`,
    top: `${10 + rand() * 75}%`,
    size: 1.5 + rand() * 2.5,
    dur: 7 + rand() * 9,
    delay: rand() * 8,
    repeatDelay: rand() * 3,
    travel: 80 + rand() * 80,
    color: rand() > 0.52
      ? `rgba(220,235,255,${(0.45 + rand() * 0.3).toFixed(2)})`
      : `rgba(45,212,191,${(0.35 + rand() * 0.25).toFixed(2)})`,
    blur: rand() > 0.5 ? 1.2 : 0.8,
  }))
})()

function DriftParticles({ reduced }) {
  if (reduced) return null
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 15,
        overflow: 'hidden',
      }}
    >
      {DRIFT_PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: p.color,
            filter: `blur(${p.blur}px)`,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          animate={{
            y: [0, -p.travel],
            opacity: [0, 0.75, 0.55, 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
            repeatDelay: p.repeatDelay,
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
  const headline = useTypewriter('Write what you cannot say out loud.', heroActive, 42)

  /* Scroll to phase */
  const scrollToPhase = (i) => {
    if (!stageRef.current) return
    const totalHeight = stageRef.current.scrollHeight - window.innerHeight
    const targetY = stageRef.current.offsetTop + (PHASES[i][0] + 0.01) * totalHeight
    window.scrollTo({ top: targetY, behavior: 'smooth' })
  }

  /* features are at phases 2-5 now (quote is phase 1, testimonials=6, CTA=7) */
  const isFeatureVisible = (idx) => activePhase === idx + 2

  return (
    <>
      <ScrollProgressBar scrollYProgress={scrollYProgress} />
      {!shouldReduceMotion && <OceanTrail scrollYProgress={scrollYProgress} />}
      <DriftParticles reduced={shouldReduceMotion} />

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
                  A safe space to feel.
                </motion.p>

                <h1 className="room-hero-headline">
                  {headline}
                  <span className="typewriter-cursor" aria-hidden="true" />
                </h1>

                <motion.p
                  className="room-hero-sub"
                  initial={{ opacity: 0, y: 14 }}
                  animate={heroActive ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 2.2, duration: 0.6, ease: EXPO }}
                >
                  A private space to write, reflect, and heal.
                </motion.p>

                {/* Floating AI CTA pill — appears after typewriter finishes */}
                <motion.a
                  href="/chat"
                  initial={{ opacity: 0, y: 12 }}
                  animate={heroActive ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 2.75, duration: 0.55, ease: EXPO }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    marginTop: '1.6rem',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '999px',
                    background: 'rgba(45,212,191,0.12)',
                    border: '1px solid rgba(45,212,191,0.35)',
                    color: 'var(--accent-teal)',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  {/* Pulse ring */}
                  <motion.span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '999px',
                      border: '1px solid rgba(45,212,191,0.5)',
                    }}
                    animate={{ scale: [1, 1.18], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <span style={{ fontSize: '1rem' }}>💬</span>
                  Talk to Heartstrings AI
                  <span style={{ opacity: 0.7 }}>→</span>
                </motion.a>

                <motion.div
                  className="scroll-hint"
                  initial={{ opacity: 0 }}
                  animate={heroActive ? { opacity: 1 } : {}}
                  transition={{ delay: 2.9, duration: 0.8 }}
                >
                  <span className="scroll-hint-text">Begin your journey</span>
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

          {/* ── PHASE 1: Emotional quote ── */}
          <AnimatePresence>
            {activePhase === 1 && (
              <motion.div
                key="quote-phase"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 30,
                  pointerEvents: 'none',
                  padding: '0 2rem',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, filter: 'blur(10px)' }}
                transition={{ duration: 0.6, ease: EXPO }}
              >
                <motion.div
                  style={{ textAlign: 'center', maxWidth: 640 }}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: 0.1, duration: 0.65, ease: EXPO }}
                >
                  {/* Decorative quote mark */}
                  <motion.div
                    aria-hidden="true"
                    style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: '5rem',
                      lineHeight: 1,
                      color: 'rgba(45,212,191,0.25)',
                      marginBottom: '-1rem',
                      userSelect: 'none',
                    }}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: EXPO }}
                  >
                    &ldquo;
                  </motion.div>

                  <motion.p
                    style={{
                      fontFamily: 'var(--font-serif), Georgia, serif',
                      fontSize: 'clamp(1.25rem, 3vw, 1.8rem)',
                      fontStyle: 'italic',
                      color: 'rgba(220,238,255,0.92)',
                      lineHeight: 1.65,
                      letterSpacing: '-0.01em',
                      textShadow: '0 0 40px rgba(45,212,191,0.2)',
                    }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28, duration: 0.7, ease: EXPO }}
                  >
                    Some feelings are too big for words.
                    <br />
                    This is a place to try anyway.
                  </motion.p>

                  {/* Soft teal divider */}
                  <motion.div
                    aria-hidden="true"
                    style={{
                      width: 48,
                      height: 1.5,
                      background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.55), transparent)',
                      margin: '1.6rem auto 0',
                      borderRadius: 2,
                    }}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.6, ease: EXPO }}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASES 2-5: Feature panels ── */}
          {features.map((feat, i) => (
            <FeaturePanel key={feat.id} feature={feat} idx={i} visible={isFeatureVisible(i)} />
          ))}

          {/* ── PHASE 6: Testimonials ── */}
          <AnimatePresence>
            {activePhase === 6 && (
              <motion.div
                key="testimonials"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 30,
                  padding: '2rem clamp(1rem, 5vw, 4rem)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EXPO }}
              >
                <motion.p
                  className="room-panel-eyebrow mb-2"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.5, ease: EXPO }}
                >
                  From the community
                </motion.p>
                <motion.h2
                  style={{
                    fontFamily: 'var(--font-serif), Georgia, serif',
                    fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)',
                    fontWeight: 700,
                    color: 'var(--text)',
                    letterSpacing: '-0.02em',
                    marginBottom: '2.5rem',
                    textAlign: 'center',
                  }}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.16, duration: 0.55, ease: EXPO }}
                >
                  Words from people who stayed.
                </motion.h2>

                <div style={{
                  display: 'flex',
                  gap: 'clamp(0.75rem, 2vw, 1.5rem)',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  maxWidth: 900,
                  width: '100%',
                }}>
                  {[
                    { quote: 'Writing letters to myself changed how I think.', name: 'Jamie', age: 24 },
                    { quote: 'My diary is the only place I am truly honest.', name: 'Priya', age: 31 },
                    { quote: 'The quotes feature got me through a really hard month.', name: 'Marcus', age: 19 },
                  ].map((t, i) => (
                    <motion.div
                      key={t.name}
                      style={{
                        flex: '1 1 240px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(220,240,255,0.10)',
                        borderRadius: 16,
                        padding: 'clamp(1.1rem, 2vw, 1.6rem)',
                        backdropFilter: 'blur(14px)',
                        WebkitBackdropFilter: 'blur(14px)',
                        boxShadow: '0 4px 32px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(45,212,191,0.08) inset',
                      }}
                      initial={{ opacity: 0, y: 24, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.12 + 0.28, duration: 0.55, ease: EXPO }}
                    >
                      {/* Quote mark */}
                      <div style={{
                        fontFamily: 'Georgia, serif',
                        fontSize: '2rem',
                        lineHeight: 1,
                        color: 'rgba(45,212,191,0.35)',
                        marginBottom: '0.5rem',
                        userSelect: 'none',
                      }} aria-hidden="true">&ldquo;</div>
                      <p style={{
                        fontSize: '0.92rem',
                        color: 'rgba(210,230,245,0.82)',
                        lineHeight: 1.7,
                        fontStyle: 'italic',
                        marginBottom: '1rem',
                      }}>{t.quote}</p>
                      <p style={{
                        fontSize: '0.75rem',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'rgba(45,212,191,0.55)',
                        fontWeight: 600,
                      }}>— {t.name}, {t.age}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASE 7: CTA with CSS particle burst ── */}
          <AnimatePresence>
            {activePhase === 7 && (
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

                {/* Teal glow behind headline */}
                <div aria-hidden="true" style={{
                  position: 'absolute',
                  top: '30%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60vw',
                  height: '40vh',
                  background: 'radial-gradient(ellipse, rgba(45,212,191,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 0,
                }} />

                <motion.p
                  className="room-panel-eyebrow mb-3"
                  style={{ position: 'relative', zIndex: 1 }}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.55, ease: EXPO }}
                >
                  You belong here
                </motion.p>

                <motion.h2
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontFamily: 'var(--font-serif), Georgia, serif',
                    fontSize: 'clamp(2rem, 5vw, 4rem)',
                    fontWeight: 700,
                    lineHeight: 1.15,
                    color: 'var(--text)',
                    letterSpacing: '-0.025em',
                    textShadow: '0 4px 48px rgba(45,212,191,0.3), 0 2px 8px rgba(0,0,0,0.5)',
                    marginBottom: '1rem',
                  }}
                  initial={{ opacity: 0, y: 28, filter: 'blur(12px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.22, duration: 0.7, ease: EXPO }}
                >
                  Your story deserves a home.
                </motion.h2>

                <motion.p
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    color: 'rgba(184,224,232,0.72)',
                    fontSize: '1.05rem',
                    maxWidth: 480,
                    lineHeight: 1.75,
                    margin: '0 auto 2.5rem',
                  }}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38, duration: 0.55, ease: EXPO }}
                >
                  Start writing today — it takes less than a minute. No pressure, no timeline. Just warmth, privacy, and space to feel.
                </motion.p>

                <motion.div
                  className="flex flex-wrap gap-3 justify-center"
                  style={{ position: 'relative', zIndex: 1 }}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.52, duration: 0.5, ease: EXPO }}
                >
                  <Link href="/register" className="room-cta-join-btn">
                    Start for free
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

          {/* Phase label — show feature eyebrow during phases 2-5 */}
          <AnimatePresence mode="wait">
            {activePhase >= 2 && activePhase <= 5 && (
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
                {features[activePhase - 2]?.eyebrow}
              </motion.div>
            )}
          </AnimatePresence>

          <NavDots activePhase={activePhase} count={8} onDotClick={scrollToPhase} />
        </div>
      </div>
    </>
  )
}
