import Link from 'next/link'
import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion'
import dynamic from 'next/dynamic'
import { spring, hoverGlow, stagger as motionStagger, journeyBeat } from '../lib/motion'
import JourneyAtmosphere from '../components/JourneyAtmosphere'
import GlassQuoteCard from '../components/ui/GlassQuoteCard'
import GlassTestimonialGrid from '../components/ui/GlassTestimonialGrid'
import GlassCtaGroup from '../components/ui/GlassCtaGroup'
import WhisperStarTrigger from '../components/WhisperStarTrigger'
import { STARS_PHASE_END } from '../components/MoonStoryScene'
import {
  buildTrailNodes,
  getTrailMilestones,
  panelAnchorFromRect,
  FEATURE_TRAIL_NODE,
  updateScriptedStarTargets,
} from '../lib/trailAnchors'

/* ease-out-expo for all panel entrances */
const EXPO = [0.16, 1, 0.3, 1]

/* ConstellationScene — Canvas-based 3D star field, no Three.js */
const ConstellationScene = dynamic(() => import('../components/ConstellationScene'), { ssr: false })
const MoonStoryScene = dynamic(() => import('../components/MoonStoryScene'), { ssr: false })

const JOURNEY_BEATS = {
  hero: { support: "You don't have to carry this alone." },
  moon: { afterQuote: 'Some words need the sky.' },
  stars: {
    release: 'Let it go upward.',
    end: "You've come as far as words can take you.",
    cta: 'When you\'re ready, release it to the stars.',
  },
}

/* ─── Feature panel data — Chat leads as the headline feature ── */
const features = [
  {
    id: 'chat',
    eyebrow: 'Not alone',
    heartbreakLine: 'When the thoughts loop at 2am, you need somewhere safe to put them.',
    healingLine: 'Heartstrings listens without fixing you — just steady presence.',
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
    heartbreakLine: 'Some feelings are too heavy to say out loud — yet.',
    healingLine: 'Seal your words until future-you is ready to read them.',
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
    heartbreakLine: 'Heartbreak does not follow a schedule — but your story still deserves a record.',
    healingLine: 'One private page at a time, no audience, no performance.',
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
    heartbreakLine: 'When your own words fail, someone else\'s might land gently.',
    healingLine: 'Bookmark lines that feel written for this exact night.',
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

/* Scroll range per phase — 9 segments across 780vh */
const PHASES = [
  [0,    0.10],  // 0: hero reveal
  [0.10, 0.22],  // 1: moon story (figures + moon)
  [0.22, STARS_PHASE_END],  // 2: stars gate — scroll stops here until button
  [STARS_PHASE_END, 0.47],  // 3: chat (trail-driven)
  [0.47, 0.59],  // 4: letter
  [0.59, 0.71],  // 5: diary
  [0.71, 0.82],  // 6: quotes
  [0.82, 0.91],  // 7: testimonials
  [0.91, 1.0],   // 8: CTA
]

const TRAIL_SCROLL_START = STARS_PHASE_END
const STARS_SCROLL_CAP = STARS_PHASE_END - 0.008
const TRAIL_SCROLL_END   = PHASES[6][1]  // 0.78 — features only, before testimonials

/** Trail draw progress 0–1; zero outside feature scroll band */
function trailProgressFromScroll(scroll) {
  if (scroll < TRAIL_SCROLL_START) return 0
  if (scroll > TRAIL_SCROLL_END) return 1
  return (scroll - TRAIL_SCROLL_START) / (TRAIL_SCROLL_END - TRAIL_SCROLL_START)
}

function featurePanelVisible(idx, trailSeg, activePhase, segmentCount) {
  if (activePhase < 3 || activePhase >= 7) return false
  const node = FEATURE_TRAIL_NODE[idx]
  const nextNode = FEATURE_TRAIL_NODE[idx + 1] ?? segmentCount
  const revealed = trailSeg >= node - 1 + 0.92
  const stillHere = trailSeg < nextNode - 0.15
  return revealed && stillHere
}

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

/* Card vertical positions — spread to avoid center overlap */
const CARD_TOPS = ['6vh', '28vh', '48vh', '66vh']

/* ─── OceanTrail — full-screen scroll-drawn constellation trail ─── */
/*
 * Draws a proper constellation: straight lines between glowing star nodes.
 * All nodes are visible as faint ghost dots from the start — you can see
 * the full shape of the constellation waiting to be drawn in.
 * rAF-throttled: scroll value stored in a ref, one draw per animation frame.
 */
function OceanTrail({ scrollYProgress, trailNodes, hidden }) {
  const canvasRef  = useRef(null)
  const scrollRef  = useRef(0)
  const rafRef     = useRef(null)
  const sizeRef    = useRef({ W: 0, H: 0 })
  const nodesRef   = useRef(trailNodes)

  nodesRef.current = trailNodes

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      sizeRef.current = { W: canvas.width, H: canvas.height }
      drawFrame()
    }

    const drawFrame = () => {
      const progress = hidden ? 0 : trailProgressFromScroll(scrollRef.current)
      render(progress)
    }

    const render = (progress) => {
      const { W, H } = sizeRef.current
      const nodes = nodesRef.current
      if (!W || !H || !nodes?.length) return
      ctx.clearRect(0, 0, W, H)
      if (progress <= 0.001 || hidden) return

      const segCount = nodes.length - 1
      const milestones = getTrailMilestones(nodes.length)
      const totalProgress = progress * segCount
      const fullSegs = Math.floor(totalProgress)
      const partial  = totalProgress - fullSegs
      const px = ([nx, ny]) => [nx * W, ny * H]

      /* Ghost: next target only (+ faint line preview) */
      const nextIdx = Math.min(fullSegs + 1, nodes.length - 1)
      if (nextIdx < nodes.length) {
        const [nx, ny] = px(nodes[nextIdx])
        const isNextMile = milestones.has(nextIdx)
        ctx.beginPath()
        ctx.arc(nx, ny, isNextMile ? 2.2 : 1.5, 0, Math.PI * 2)
        ctx.fillStyle = isNextMile ? 'rgba(45,212,191,0.35)' : 'rgba(167,243,208,0.14)'
        ctx.fill()
        if (fullSegs < segCount) {
          const [ax, ay] = px(nodes[fullSegs])
          ctx.setLineDash([4, 8])
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(nx, ny)
          ctx.strokeStyle = 'rgba(167,243,208,0.12)'
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      /* Completed segments */
      for (let s = 0; s < fullSegs && s < segCount; s++) {
        const [ax, ay] = px(nodes[s])
        const [bx, by] = px(nodes[s + 1])
        const ageAlpha = 0.3 + 0.4 * (s / segCount)
        const grad = ctx.createLinearGradient(ax, ay, bx, by)
        grad.addColorStop(0, `rgba(45,212,191,${(ageAlpha * 0.55).toFixed(2)})`)
        grad.addColorStop(0.5, `rgba(56,189,248,${ageAlpha.toFixed(2)})`)
        grad.addColorStop(1, `rgba(167,243,208,${(ageAlpha * 0.75).toFixed(2)})`)
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      /* Active segment — comet toward next card */
      if (fullSegs < segCount && partial > 0.005) {
        const [ax, ay] = px(nodes[fullSegs])
        const [bx, by] = px(nodes[fullSegs + 1])
        const ex = ax + (bx - ax) * partial
        const ey = ay + (by - ay) * partial
        const grad = ctx.createLinearGradient(ax, ay, ex, ey)
        grad.addColorStop(0, 'rgba(45,212,191,0.1)')
        grad.addColorStop(0.6, 'rgba(56,189,248,0.65)')
        grad.addColorStop(1, 'rgba(200,252,245,0.98)')
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(ex, ey)
        ctx.strokeStyle = grad
        ctx.lineWidth = 2
        ctx.shadowBlur = 8
        ctx.shadowColor = 'rgba(45,212,191,0.7)'
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.beginPath()
        ctx.arc(ex, ey, 3, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(200,255,245,0.96)'
        ctx.shadowBlur = 14
        ctx.shadowColor = 'rgba(45,212,191,0.85)'
        ctx.fill()
        ctx.shadowBlur = 0
      }

      /* Arrived nodes — milestone bloom when segment nearly complete */
      for (let ni = 0; ni <= fullSegs && ni < nodes.length; ni++) {
        const isMile = milestones.has(ni)
        const onIncoming = ni > 0 && fullSegs === ni - 1
        if (isMile && onIncoming && partial < 0.85) continue

        const [nx, ny] = px(nodes[ni])
        const bloomR = isMile ? 20 : 7
        const dotR = isMile ? 3.5 : 2
        const bloom = ctx.createRadialGradient(nx, ny, 0, nx, ny, bloomR)
        bloom.addColorStop(0, `rgba(45,212,191,${isMile ? 0.5 : 0.25})`)
        bloom.addColorStop(1, 'rgba(45,212,191,0)')
        ctx.beginPath()
        ctx.arc(nx, ny, bloomR, 0, Math.PI * 2)
        ctx.fillStyle = bloom
        ctx.fill()
        ctx.beginPath()
        ctx.arc(nx, ny, dotR, 0, Math.PI * 2)
        ctx.fillStyle = isMile ? 'rgba(200,255,245,0.92)' : 'rgba(167,243,208,0.8)'
        ctx.fill()
      }
    }

    const scheduleDraw = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        drawFrame()
      })
    }

    resize()
    window.addEventListener('resize', resize)
    scrollRef.current = scrollYProgress.get()
    drawFrame()

    const unsub = scrollYProgress.on('change', v => {
      scrollRef.current = v
      scheduleDraw()
    })
    return () => {
      window.removeEventListener('resize', resize)
      unsub()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [scrollYProgress, hidden, trailNodes])

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

/* ─── Feature panel — always mounted for anchor measure; bursts on trail hit ─── */
function FeaturePanel({ feature, idx, visible, panelRef }) {
  const isLeft = feature.side === 'left'
  const cardTop = CARD_TOPS[idx]
  const panel = (
    <motion.div
      ref={panelRef}
      className={`room-panel${feature.highlight ? ' room-panel--spotlight' : ''}`}
      aria-hidden={!visible}
      style={{
        [isLeft ? 'left' : 'right']: 'clamp(1.25rem, 4vw, 4.5rem)',
        top: cardTop,
        transformOrigin: isLeft ? 'left center' : 'right center',
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        ...(feature.highlight && visible && {
          boxShadow: '0 0 48px rgba(45,212,191,0.18), 0 0 0 1px rgba(45,212,191,0.22)',
        }),
      }}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.04,
        filter: visible ? 'blur(0px)' : 'blur(20px)',
      }}
      transition={{ type: 'spring', stiffness: 180, damping: 20, mass: 1.1, opacity: { duration: 0.28 } }}
      {...(visible ? hoverGlow : {})}
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

          {feature.heartbreakLine && (
            <motion.p
              className="feature-heartbreak-line"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
              transition={{ delay: 0.2, duration: 0.45, ease: EXPO }}
            >
              {feature.heartbreakLine}
            </motion.p>
          )}

          <motion.p
            className="room-panel-body"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.5, ease: EXPO }}
          >
            {feature.body}
          </motion.p>

          {feature.healingLine && (
            <motion.p
              className="feature-healing-line"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
              transition={{ delay: 0.32, duration: 0.5, ease: EXPO }}
            >
              {feature.healingLine}
            </motion.p>
          )}

          {feature.demo.type === 'letter' && <LetterDemo lines={feature.demo.lines} />}
          {feature.demo.type === 'chat'   && <ChatDemo messages={feature.demo.messages} />}
          {feature.demo.type === 'quotes' && <QuotesDemo items={feature.demo.items} />}
          {feature.demo.type === 'diary'  && <DiaryDemo lines={feature.demo.lines} />}

          <motion.div
            initial={false}
            animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
            transition={{ delay: visible ? 0.38 : 0, duration: 0.45, ease: EXPO }}
          >
            <Link href={feature.href} className="room-panel-link mt-4 inline-flex">
              {feature.link} →
            </Link>
          </motion.div>
    </motion.div>
  )

  return panel
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
            willChange: 'transform, opacity',
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

  const panelRefs = useRef(features.map(() => null))
  const [trailNodes, setTrailNodes] = useState(() => buildTrailNodes(null))
  const trailSegmentCount = trailNodes.length - 1

  const measurePanelAnchors = useCallback(() => {
    const W = window.innerWidth
    const H = window.innerHeight
    if (!W || !H) return
    const anchors = features.map((feat, i) => {
      const el = panelRefs.current[i]
      if (!el) return null
      const rect = el.getBoundingClientRect()
      if (rect.width < 10) return null
      return panelAnchorFromRect(rect, feat.side, W, H)
    })
    if (anchors.every(Boolean)) {
      setTrailNodes(buildTrailNodes(anchors))
      updateScriptedStarTargets(anchors)
    }
  }, [])

  useLayoutEffect(() => {
    measurePanelAnchors()
    window.addEventListener('resize', measurePanelAnchors)
    return () => window.removeEventListener('resize', measurePanelAnchors)
  }, [measurePanelAnchors])

  const [entryDone, setEntryDone]   = useState(false)
  const [darkOverlay, setDarkOverlay] = useState(true)
  const [heroActive, setHeroActive]  = useState(false)
  const [activePhase, setActivePhase] = useState(0)
  const [trailSeg, setTrailSeg]       = useState(0)
  const [ctaUser, setCtaUser]        = useState(null)   // auth state for CTA
  const [isLaunching, setIsLaunching] = useState(false)
  const [constellationLaunchToken, setConstellationLaunchToken] = useState(0)
  const [constellationUnlocked, setConstellationUnlocked] = useState(false)

  const gatedScrollProgress = useTransform(scrollYProgress, (v) =>
    constellationUnlocked ? v : Math.min(v, STARS_SCROLL_CAP)
  )

  /* Fetch auth state once — only used to personalise the CTA phase */
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setCtaUser(d.user) })
      .catch(() => {})
  }, [])

  /* Drive active phase from scroll — functional updater prevents
     re-renders on every tick; only fires when phase actually changes */
  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      let next = 0
      for (let i = PHASES.length - 1; i >= 0; i--) {
        if (v >= PHASES[i][0]) { next = i; break }
      }
      setActivePhase(prev => prev === next ? prev : next)
    })
    return unsub
  }, [scrollYProgress])

  useEffect(() => {
    const updateSeg = (scroll) => {
      const seg = trailProgressFromScroll(scroll) * trailSegmentCount
      setTrailSeg(prev => (Math.abs(prev - seg) < 0.008 ? prev : seg))
    }
    updateSeg(scrollYProgress.get())
    const unsub = scrollYProgress.on('change', updateSeg)
    return unsub
  }, [scrollYProgress, trailSegmentCount])

  /* Block scroll past stars gate until user taps the whisper star */
  useEffect(() => {
    if (constellationUnlocked) return undefined
    const clampScroll = () => {
      const stage = stageRef.current
      if (!stage) return
      const totalHeight = stage.scrollHeight - window.innerHeight
      if (totalHeight <= 0) return
      const maxY = stage.offsetTop + STARS_SCROLL_CAP * totalHeight
      if (window.scrollY > maxY + 1) {
        window.scrollTo({ top: maxY, behavior: 'auto' })
      }
    }
    clampScroll()
    window.addEventListener('scroll', clampScroll, { passive: true })
    return () => window.removeEventListener('scroll', clampScroll)
  }, [constellationUnlocked])

  const starsEndVisible = useTransform(
    scrollYProgress,
    [0.26, 0.30, STARS_SCROLL_CAP],
    constellationUnlocked ? [0, 0, 0] : [0, 0.6, 1]
  )

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
    if (i >= 3 && !constellationUnlocked) {
      i = 2
    }
    const totalHeight = stageRef.current.scrollHeight - window.innerHeight
    const phaseEnd = i === 2 && !constellationUnlocked ? STARS_SCROLL_CAP : PHASES[i][0] + 0.01
    const targetY = stageRef.current.offsetTop + phaseEnd * totalHeight
    window.scrollTo({ top: targetY, behavior: 'smooth' })
  }

  const handleWhisperStarLaunch = useCallback(() => {
    if (activePhase !== 2 || isLaunching) return
    setConstellationUnlocked(true)
    setIsLaunching(true)
    setConstellationLaunchToken(t => t + 1)

    const scrollDelay = shouldReduceMotion ? 0 : 400
    const launchDuration = shouldReduceMotion ? 200 : 1200

    setTimeout(() => scrollToPhase(3), scrollDelay)
    setTimeout(() => setIsLaunching(false), launchDuration)
  }, [activePhase, isLaunching, shouldReduceMotion])

  const showFeature = (idx) =>
    featurePanelVisible(idx, trailSeg, activePhase, trailSegmentCount)

  const moonSupportOpacity = useTransform(
    scrollYProgress,
    [0.10, 0.14, 0.20, 0.22],
    shouldReduceMotion ? [1, 1, 1, 1] : [0, 0.4, 1, 1]
  )
  const moonSupportY = useTransform(
    scrollYProgress,
    [0.10, 0.16, 0.22],
    shouldReduceMotion ? [0, 0, 0] : [12, 4, 0]
  )

  const trailFeatureLabel = useMemo(() => {
    if (activePhase < 3 || activePhase >= 7) return -1
    for (let i = FEATURE_TRAIL_NODE.length - 1; i >= 0; i--) {
      if (featurePanelVisible(i, trailSeg, activePhase, trailSegmentCount)) return i
    }
    return -1
  }, [trailSeg, activePhase, trailSegmentCount])

  return (
    <>
      <ScrollProgressBar scrollYProgress={scrollYProgress} />
      {!shouldReduceMotion && (
        <OceanTrail
          scrollYProgress={scrollYProgress}
          trailNodes={trailNodes}
          hidden={activePhase < 3 || activePhase >= 7}
        />
      )}
      <DriftParticles reduced={shouldReduceMotion} />

      <div ref={stageRef} className="room-stage">
        <motion.div
          className={`room-sticky${isLaunching ? ' room-sticky--launching' : ''}`}
          style={{ transformOrigin: '50% 58%' }}
          animate={
            isLaunching && !shouldReduceMotion
              ? { scale: 1.85, filter: 'brightness(1.08)' }
              : { scale: 1, filter: 'brightness(1)' }
          }
          transition={
            isLaunching && !shouldReduceMotion
              ? { ...spring.page, duration: 1.1 }
              : { duration: 0.5, ease: EXPO }
          }
        >

          <JourneyAtmosphere scrollProgress={gatedScrollProgress} />

          {/* Constellation scene — Canvas 3D camera dolly */}
          <ConstellationScene
            scrollProgress={gatedScrollProgress}
            launchToken={constellationLaunchToken}
          />

          {/* Moon story — moon, whisper ripples, handoff */}
          {!shouldReduceMotion && (
            <MoonStoryScene
              scrollProgress={gatedScrollProgress}
              launchBurst={constellationLaunchToken}
            />
          )}

          <WhisperStarTrigger
            visible={activePhase === 2 && !isLaunching && !constellationUnlocked}
            onLaunch={handleWhisperStarLaunch}
            emphasized={activePhase === 2}
          />

          {/* Stars gate — feels like the end of scroll until button */}
          <AnimatePresence>
            {activePhase === 2 && !constellationUnlocked && (
              <motion.div
                key="stars-gate-end"
                className="stars-gate-end"
                style={{ opacity: starsEndVisible }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EXPO }}
              >
                <p className="stars-gate-end__line">{JOURNEY_BEATS.stars.end}</p>
                <p className="stars-gate-end__cta">{JOURNEY_BEATS.stars.cta}</p>
              </motion.div>
            )}
          </AnimatePresence>

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

                <motion.p
                  className="journey-hero-support"
                  initial={journeyBeat.initial}
                  animate={heroActive ? journeyBeat.animate : journeyBeat.initial}
                  transition={{ delay: 2.45 }}
                >
                  {JOURNEY_BEATS.hero.support}
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

          {/* ── PHASE 1: Moon story copy ── */}
          <AnimatePresence>
            {activePhase === 1 && (
              <motion.div
                key="moon-phase"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 30,
                  pointerEvents: 'none',
                  padding: 'clamp(6rem, 18vh, 8rem) 2rem',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, filter: 'blur(10px)' }}
                transition={{ duration: 0.6, ease: EXPO }}
              >
                <GlassQuoteCard
                  eyebrow="To the moon"
                  quote={
                    <>
                      I said it to the moon,
                      <br />
                      because you were not there to hear it.
                    </>
                  }
                  support={JOURNEY_BEATS.moon.afterQuote}
                  supportStyle={{ opacity: moonSupportOpacity, y: moonSupportY }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASE 2: Stars release copy ── */}
          <AnimatePresence>
            {activePhase === 2 && (
              <motion.div
                key="stars-phase"
                className="journey-stars-overlay"
                initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                animate={{
                  opacity: isLaunching ? 0 : 1,
                  y: isLaunching ? -8 : 0,
                  filter: isLaunching ? 'blur(12px)' : 'blur(0px)',
                }}
                exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                transition={{ duration: 0.55, ease: EXPO }}
              >
                <p className="journey-stars-overlay__text">{JOURNEY_BEATS.stars.release}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASES 3-6: Feature panels ── */}
          {features.map((feat, i) => (
            <FeaturePanel
              key={feat.id}
              feature={feat}
              idx={i}
              visible={showFeature(i)}
              panelRef={el => { panelRefs.current[i] = el }}
            />
          ))}

          {/* ── PHASE 7: Testimonials ── */}
          <AnimatePresence>
            {activePhase === 7 && (
              <motion.div
                key="testimonials"
                className="room-testimonials"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 40,
                  padding: '2rem clamp(2rem, 8vw, 6rem)',
                  maxWidth: 'min(960px, 92vw)',
                  margin: '0 auto',
                  left: 0,
                  right: 0,
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

                <GlassTestimonialGrid
                  items={[
                    { quote: 'Writing letters to myself changed how I think.', name: 'Jamie', age: 24 },
                    { quote: 'My diary is the only place I am truly honest.', name: 'Priya', age: 31 },
                    { quote: 'The quotes feature got me through a really hard month.', name: 'Marcus', age: 19 },
                  ]}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PHASE 7: CTA with CSS particle burst ── */}
          <AnimatePresence>
            {activePhase === 8 && (
              <motion.div
                key="cta"
                className="room-cta-panel room-cta-panel--healing"
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

                {ctaUser ? (
                  /* ── Logged-in: personalised greeting + quick-access ── */
                  <motion.div
                    style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.52, duration: 0.5, ease: EXPO }}
                  >
                    <p style={{
                      fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                      color: 'rgba(120,240,220,0.9)',
                      fontWeight: 600,
                      marginBottom: '0.5rem',
                      fontFamily: 'var(--font-serif), Georgia, serif',
                      fontStyle: 'italic',
                    }}>
                      Welcome back{ctaUser.email ? `, ${ctaUser.email.split('@')[0]}` : ''} ✦
                    </p>
                    <p style={{
                      fontSize: '0.95rem',
                      color: 'rgba(184,224,232,0.65)',
                      marginBottom: '2rem',
                    }}>
                      Your space is waiting. Keep writing, keep healing.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {[
                        { href: '/chat',              label: 'AI Chat →' },
                        { href: '/diary',             label: 'My Diary →' },
                        { href: '/letter-to-yourself', label: 'My Letter →' },
                        { href: '/quotes',            label: 'Quotes →' },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.7rem 1.4rem',
                            borderRadius: 99,
                            border: '1px solid rgba(45,212,191,0.25)',
                            color: 'rgba(184,224,232,0.85)',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            background: 'rgba(45,212,191,0.07)',
                            backdropFilter: 'blur(8px)',
                            transition: 'border-color 0.2s, background 0.2s',
                          }}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    style={{ position: 'relative', zIndex: 1 }}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.52, duration: 0.5, ease: EXPO }}
                  >
                    <GlassCtaGroup
                      primary={{ href: '/register', label: 'Start for free' }}
                      secondary={[{ href: '/login', label: 'Already have a space' }]}
                    />
                  </motion.div>
                )}

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

          {/* Phase label — when trail reaches a feature node */}
          <AnimatePresence mode="wait">
            {trailFeatureLabel >= 0 && (
              <motion.div
                key={`label-${trailFeatureLabel}`}
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
                {features[trailFeatureLabel]?.eyebrow}
              </motion.div>
            )}
          </AnimatePresence>

          <NavDots activePhase={activePhase} count={9} onDotClick={scrollToPhase} />
        </motion.div>
      </div>
    </>
  )
}
