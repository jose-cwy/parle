import { useEffect, useRef } from 'react'
import { motion, useTransform } from 'framer-motion'

/* ─── Seeded PRNG for stable star positions ─────────────────── */
function seededRng(seed) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5
    return ((s >>> 0) / 0xffffffff)
  }
}

/* ─── Constellation node stars — three shapes ───────────────── */
/* Heart constellation (thematic: Heartstrings) */
const HEART_NODES = [
  { x: -120, y: -280, z: 350 },
  { x:  -60, y: -340, z: 370 },
  { x:    0, y: -300, z: 340 },
  { x:   60, y: -340, z: 360 },
  { x:  120, y: -280, z: 350 },
  { x:  140, y: -200, z: 320 },
  { x:    0, y:  -80, z: 300 },
  { x: -140, y: -200, z: 325 },
]
const HEART_EDGES = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],
]

/* Thread arc constellation (the journey path) */
const THREAD_NODES = [
  { x: -380, y:  100, z: 500 },
  { x: -260, y:   40, z: 480 },
  { x: -120, y:   10, z: 460 },
  { x:    0, y:   20, z: 450 },
  { x:  130, y:   -5, z: 460 },
  { x:  280, y:   50, z: 475 },
  { x:  400, y:  120, z: 500 },
]
const THREAD_EDGES = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]

/* Horizon arc (3 bright anchors near centre) */
const ARC_NODES = [
  { x: -200, y:  250, z: 420 },
  { x:    0, y:  200, z: 400 },
  { x:  200, y:  250, z: 420 },
]
const ARC_EDGES = [[0,1],[1,2]]

/* All constellation stars indexed by their position in the full array */
const CONST_STARS = [...HEART_NODES, ...THREAD_NODES, ...ARC_NODES]
const CONST_STAR_COUNT = CONST_STARS.length  // 18

/* Edge index offsets into the final stars array */
const HEART_OFFSET  = 0
const THREAD_OFFSET = HEART_NODES.length
const ARC_OFFSET    = HEART_NODES.length + THREAD_NODES.length

const ALL_EDGES = [
  ...HEART_EDGES.map(([a, b]) => [a + HEART_OFFSET,  b + HEART_OFFSET]),
  ...THREAD_EDGES.map(([a, b]) => [a + THREAD_OFFSET, b + THREAD_OFFSET]),
  ...ARC_EDGES.map(([a, b]) => [a + ARC_OFFSET, b + ARC_OFFSET]),
]

/* ─── Build full star array (constellation + scattered) ─────── */
const TOTAL_STARS = 130
const SCATTER_COUNT = TOTAL_STARS - CONST_STAR_COUNT

function buildStars() {
  const rand = seededRng(0xc0de_beef)
  const stars = []

  /* Constellation nodes first */
  for (let i = 0; i < CONST_STARS.length; i++) {
    const s = CONST_STARS[i]
    stars.push({
      x: s.x,
      y: s.y,
      z: s.z,
      baseZ: s.z,
      size: 1.4 + rand() * 1.2,
      brightness: 0.75 + rand() * 0.25,
      isNode: true,
      twinkleOffset: rand() * Math.PI * 2,
      twinkleSpeed: 0.6 + rand() * 0.8,
    })
  }

  /* Scattered background stars */
  for (let i = 0; i < SCATTER_COUNT; i++) {
    stars.push({
      x: (rand() * 2 - 1) * 900,
      y: (rand() * 2 - 1) * 600,
      z: 80 + rand() * 1100,
      baseZ: 0,  // recalculated per-frame for infinite wrap
      size: 0.5 + rand() * 1.6,
      brightness: 0.25 + rand() * 0.65,
      isNode: false,
      twinkleOffset: rand() * Math.PI * 2,
      twinkleSpeed: 0.4 + rand() * 1.2,
    })
  }

  /* Store initial z for scatter stars so wrap knows max range */
  for (let i = CONST_STAR_COUNT; i < stars.length; i++) {
    stars[i].baseZ = stars[i].z
  }

  return stars
}

const STARS = buildStars()
const FOCAL = 600    // perspective focal length
const CAM_MAX = 620  // max camera Z travel

/* ─── Aurora overlay — slow-breathing teal/indigo orbs ─────── */
const ORBS = [
  {
    id: 'teal',
    style: {
      left: '12%', top: '22%',
      width: '44rem', height: '34rem',
      background: 'radial-gradient(ellipse, rgba(45,212,191,0.24) 0%, transparent 70%)',
    },
    dur: 10, delay: 0,
  },
  {
    id: 'indigo',
    style: {
      right: '8%', top: '10%',
      width: '36rem', height: '28rem',
      background: 'radial-gradient(ellipse, rgba(99,102,241,0.2) 0%, transparent 70%)',
    },
    dur: 13, delay: -4,
  },
  {
    id: 'blue',
    style: {
      left: '48%', bottom: '5%',
      width: '28rem', height: '22rem',
      background: 'radial-gradient(ellipse, rgba(56,189,248,0.14) 0%, transparent 70%)',
    },
    dur: 8, delay: -2,
  },
]

/* ─── Main component ─────────────────────────────────────────── */
export default function ConstellationScene({ scrollProgress }) {
  const canvasRef  = useRef(null)
  const mouseRef   = useRef({ x: -9999, y: -9999 })
  const rafRef     = useRef(null)
  const timeRef    = useRef(0)

  /* Camera Z driven by scroll: 0 → CAM_MAX */
  const cameraZ = useTransform(scrollProgress, [0, 1], [0, CAM_MAX])
  /* Constellation alpha: invisible at hero, fully drawn by phase 2 */
  const constAlpha = useTransform(scrollProgress, [0, 0.12, 0.55], [0, 0, 0.72])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /* Resize canvas to fill the sticky container */
    const resize = () => {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    /* Mouse tracking */
    const onMouse = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 } }
    canvas.addEventListener('mousemove', onMouse, { passive: true })
    canvas.addEventListener('mouseleave', onLeave)

    /* ─── rAF draw loop ────────────────────────────────────────── */
    const draw = (timestamp) => {
      rafRef.current = requestAnimationFrame(draw)
      timeRef.current = timestamp * 0.001  // seconds

      const ctx   = canvas.getContext('2d')
      const W     = canvas.width
      const H     = canvas.height
      const cx    = W * 0.5
      const cy    = H * 0.5
      const camZ  = cameraZ.get()
      const cAlpha = constAlpha.get()
      const mx    = mouseRef.current.x
      const my    = mouseRef.current.y
      const t     = timeRef.current

      ctx.clearRect(0, 0, W, H)

      /* Project all stars to screen coords */
      const projected = new Array(STARS.length)

      for (let i = 0; i < STARS.length; i++) {
        const star = STARS[i]
        let z = star.z - camZ

        /* Wrap scattered stars when they pass the camera */
        if (!star.isNode) {
          if (z < 10) {
            star.z += 1100
            z = star.z - camZ
          }
        }

        const depth = Math.max(z, 1)
        const scale = FOCAL / depth

        const sx = star.x * scale + cx
        const sy = star.y * scale + cy

        /* Twinkle */
        const twinkle = 0.6 + 0.4 * Math.sin(t * star.twinkleSpeed + star.twinkleOffset)
        const alpha   = star.brightness * twinkle

        /* Size grows as star gets closer */
        const r = star.size * scale * 0.55

        /* Cull stars outside viewport with a margin */
        const inView = sx > -50 && sx < W + 50 && sy > -50 && sy < H + 50 && depth < 1200

        projected[i] = { sx, sy, r: Math.max(r, 0.3), alpha, inView, depth }
      }

      /* ── Draw constellation lines ────────────────────────────── */
      if (cAlpha > 0.005) {
        ctx.save()
        ctx.lineWidth = 1.2

        for (const [a, b] of ALL_EDGES) {
          const pa = projected[a]
          const pb = projected[b]
          if (!pa || !pb || !pa.inView && !pb.inView) continue

          /* Depth-fade: lines closer to camera are slightly brighter */
          const avgDepth = (pa.depth + pb.depth) * 0.5
          const depthFade = Math.max(0, 1 - avgDepth / 900)
          const lineAlpha = cAlpha * (0.3 + 0.7 * depthFade)

          const grad = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy)
          grad.addColorStop(0, `rgba(45,212,191,${lineAlpha})`)
          grad.addColorStop(1, `rgba(56,189,248,${lineAlpha * 0.7})`)

          ctx.strokeStyle = grad
          ctx.beginPath()
          ctx.moveTo(pa.sx, pa.sy)
          ctx.lineTo(pb.sx, pb.sy)
          ctx.stroke()
        }

        ctx.restore()
      }

      /* ── Draw mouse proximity lines ──────────────────────────── */
      if (mx > -1000) {
        ctx.save()
        ctx.lineWidth = 0.9

        for (let i = 0; i < STARS.length; i++) {
          const p = projected[i]
          if (!p || !p.inView) continue
          const dx   = p.sx - mx
          const dy   = p.sy - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 130) {
            const lineAlpha = (1 - dist / 130) * 0.45
            ctx.strokeStyle = `rgba(56,189,248,${lineAlpha})`
            ctx.beginPath()
            ctx.moveTo(p.sx, p.sy)
            ctx.lineTo(mx, my)
            ctx.stroke()
          }
        }

        /* Glow dot at cursor */
        const glowR = 5 + 2 * Math.sin(t * 2.4)
        const grd = ctx.createRadialGradient(mx, my, 0, mx, my, glowR * 3)
        grd.addColorStop(0, 'rgba(45,212,191,0.45)')
        grd.addColorStop(1, 'rgba(45,212,191,0)')
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(mx, my, glowR * 3, 0, Math.PI * 2)
        ctx.fill()

        ctx.restore()
      }

      /* ── Draw stars ──────────────────────────────────────────── */
      for (let i = 0; i < STARS.length; i++) {
        const p = projected[i]
        if (!p || !p.inView || p.r < 0.15) continue

        const star = STARS[i]
        ctx.save()

        if (star.isNode && cAlpha > 0.01) {
          /* Constellation nodes: soft teal glow halo */
          const haloR = p.r * 4.5
          const halo  = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, haloR)
          halo.addColorStop(0, `rgba(45,212,191,${p.alpha * 0.35 * cAlpha})`)
          halo.addColorStop(1, 'rgba(45,212,191,0)')
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, haloR, 0, Math.PI * 2)
          ctx.fill()

          /* Bright core */
          ctx.fillStyle = `rgba(200,248,250,${p.alpha})`
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, p.r * 1.15, 0, Math.PI * 2)
          ctx.fill()
        } else {
          /* Regular stars: white-blue, small */
          ctx.fillStyle = `rgba(220,240,255,${p.alpha})`
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMouse)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [cameraZ, constAlpha])

  return (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#020d1a' }}
      aria-hidden="true"
    >
      {/* ── Base deep gradient ── */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `
            radial-gradient(ellipse 140% 90% at 50% 110%,
              #060e24 0%, #020d1a 50%, #010810 100%)
          `,
        }}
      />

      {/* ── Canvas: stars + constellation lines + mouse glow ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          display: 'block',
        }}
      />

      {/* ── Aurora orbs — screen blend, sit above canvas ── */}
      {ORBS.map((orb) => (
        <motion.div
          key={orb.id}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            filter: 'blur(64px)',
            pointerEvents: 'none',
            mixBlendMode: 'screen',
            ...orb.style,
          }}
          animate={{
            opacity: [0.45, 0.9, 0.55, 1, 0.45],
            scale:   [1, 1.08, 0.95, 1.05, 1],
          }}
          transition={{
            duration: orb.dur,
            repeat: Infinity,
            ease: [0.45, 0, 0.2, 1],
            delay: orb.delay,
          }}
        />
      ))}

      {/* ── Horizon fade — grounds the scene ── */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(
            to top,
            rgba(2,8,20,0.9) 0%,
            rgba(3,12,26,0.55) 16%,
            transparent 42%
          )`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Cinematic vignette ── */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(
            ellipse 90% 82% at 50% 50%,
            transparent 40%,
            rgba(1,5,15,0.65) 100%
          )`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Film grain ── */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: 0.055,
          backgroundImage: `
            radial-gradient(rgba(255,255,255,0.9) 0.4px, transparent 0.4px),
            radial-gradient(rgba(45,212,191,0.3) 0.3px, transparent 0.3px)
          `,
          backgroundSize: '5px 5px, 9px 9px',
          backgroundPosition: '0 0, 2px 3px',
          pointerEvents: 'none',
          animation: 'grainShift 6s steps(4) infinite',
        }}
      />
    </div>
  )
}
