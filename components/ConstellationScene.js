import { useEffect, useRef } from 'react'
import { motion, useTransform } from 'framer-motion'
import { moonStoryStarFade, STARS_PHASE_START, STARS_PHASE_END } from './MoonStoryScene'
import { scriptedStarTargets } from '../lib/trailAnchors'

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

/* Bridge cluster — upper-right region */
const BRIDGE2_NODES = [
  { x:  480, y: -320, z: 580 },
  { x:  560, y: -260, z: 560 },
  { x:  500, y: -180, z: 540 },
  { x:  680, y: -240, z: 570 },
  { x:  720, y: -160, z: 555 },
]
const BRIDGE2_EDGES = [[0,1],[1,2],[1,3],[3,4]]

/* Crescent arc — lower-left quadrant */
const CRESCENT_NODES = [
  { x: -580, y:  320, z: 600 },
  { x: -520, y:  230, z: 580 },
  { x: -440, y:  170, z: 560 },
  { x: -360, y:  200, z: 545 },
  { x: -300, y:  280, z: 560 },
]
const CRESCENT_EDGES = [[0,1],[1,2],[2,3],[3,4]]

/* Orion-style belt + shoulders — centre-left, mid depth */
const ORION_NODES = [
  { x: -180, y:  -80, z: 680 },  // left shoulder
  { x:  -60, y: -120, z: 660 },  // right shoulder
  { x: -160, y:   40, z: 700 },  // belt left
  { x:  -80, y:   50, z: 690 },  // belt centre
  { x:    0, y:   35, z: 680 },  // belt right
  { x: -130, y:  160, z: 710 },  // foot left
  { x:   20, y:  150, z: 700 },  // foot right
]
const ORION_EDGES = [[0,2],[1,2],[2,3],[3,4],[4,1],[3,5],[4,6]]

/* Diamond / kite — upper-left, far depth */
const DIAMOND_NODES = [
  { x: -420, y: -380, z: 820 },  // top
  { x: -520, y: -280, z: 800 },  // left
  { x: -340, y: -280, z: 810 },  // right
  { x: -420, y: -180, z: 800 },  // bottom
  { x: -480, y: -340, z: 815 },  // inner left
  { x: -360, y: -340, z: 815 },  // inner right
]
const DIAMOND_EDGES = [[0,1],[0,2],[1,3],[2,3],[1,4],[2,5],[4,5]]

/* Scorpion tail — lower-right, varies depth */
const SCORPION_NODES = [
  { x:  300, y:  200, z: 620 },
  { x:  380, y:  180, z: 640 },
  { x:  440, y:  230, z: 660 },
  { x:  500, y:  200, z: 650 },
  { x:  560, y:  250, z: 670 },
  { x:  620, y:  220, z: 660 },
  { x:  680, y:  260, z: 680 },
]
const SCORPION_EDGES = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]

/* Cassiopeia W — top-right area, medium depth */
const CASS_NODES = [
  { x:  200, y: -450, z: 750 },
  { x:  280, y: -400, z: 730 },
  { x:  360, y: -460, z: 740 },
  { x:  440, y: -400, z: 730 },
  { x:  520, y: -450, z: 745 },
]
const CASS_EDGES = [[0,1],[1,2],[2,3],[3,4]]

/* All constellation stars indexed by their position in the full array */
const CONST_STARS = [
  ...HEART_NODES,
  ...THREAD_NODES,
  ...ARC_NODES,
  ...BRIDGE2_NODES,
  ...CRESCENT_NODES,
  ...ORION_NODES,
  ...DIAMOND_NODES,
  ...SCORPION_NODES,
  ...CASS_NODES,
]
const CONST_STAR_COUNT = CONST_STARS.length

/* Edge index offsets */
const HEART_OFFSET    = 0
const THREAD_OFFSET   = HEART_NODES.length
const ARC_OFFSET      = THREAD_OFFSET + THREAD_NODES.length
const BRIDGE2_OFFSET  = ARC_OFFSET    + ARC_NODES.length
const CRESCENT_OFFSET = BRIDGE2_OFFSET + BRIDGE2_NODES.length
const ORION_OFFSET    = CRESCENT_OFFSET + CRESCENT_NODES.length
const DIAMOND_OFFSET  = ORION_OFFSET    + ORION_NODES.length
const SCORPION_OFFSET = DIAMOND_OFFSET  + DIAMOND_NODES.length
const CASS_OFFSET     = SCORPION_OFFSET + SCORPION_NODES.length

const ALL_EDGES = [
  ...HEART_EDGES.map(([a,b])    => [a + HEART_OFFSET,    b + HEART_OFFSET]),
  ...THREAD_EDGES.map(([a,b])   => [a + THREAD_OFFSET,   b + THREAD_OFFSET]),
  ...ARC_EDGES.map(([a,b])      => [a + ARC_OFFSET,      b + ARC_OFFSET]),
  ...BRIDGE2_EDGES.map(([a,b])  => [a + BRIDGE2_OFFSET,  b + BRIDGE2_OFFSET]),
  ...CRESCENT_EDGES.map(([a,b]) => [a + CRESCENT_OFFSET, b + CRESCENT_OFFSET]),
  ...ORION_EDGES.map(([a,b])    => [a + ORION_OFFSET,    b + ORION_OFFSET]),
  ...DIAMOND_EDGES.map(([a,b])  => [a + DIAMOND_OFFSET,  b + DIAMOND_OFFSET]),
  ...SCORPION_EDGES.map(([a,b]) => [a + SCORPION_OFFSET, b + SCORPION_OFFSET]),
  ...CASS_EDGES.map(([a,b])     => [a + CASS_OFFSET,     b + CASS_OFFSET]),
]

/* ─── Shooting star pool — 3 independent slots ──────────────── */
/*
 * Each slot fires at a random interval. When active, it renders as a
 * glowing streak moving diagonally across the canvas.
 * Seeded initial offsets so first shots feel natural.
 */
const SHOOT_POOL = [
  { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, nextFire: 1800 },
  { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, nextFire: 3600 },
  { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, nextFire: 5400 },
]
let _lastShootTs = 0  // tracks rAF timestamp for delta-time

function spawnShooter(slot, W, H) {
  /* Start from a random point on the top or left edge */
  const edge = Math.random() > 0.5
  slot.x = edge ? Math.random() * W * 0.8 : Math.random() * W * 0.2
  slot.y = edge ? Math.random() * H * 0.3 : Math.random() * H * 0.4
  const speed = 480 + Math.random() * 320  // px/s
  const angle = (Math.PI / 4) + (Math.random() - 0.5) * (Math.PI / 6)
  slot.vx = Math.cos(angle) * speed
  slot.vy = Math.sin(angle) * speed
  slot.maxLife = 0.45 + Math.random() * 0.25  // seconds
  slot.life = slot.maxLife
  slot.active = true
}

/** Scripted streak along normalized path (moon → trail handoff → chat node) */
export function spawnDirectedShooter(slot, from, to, W, H) {
  slot.x = from[0] * W
  slot.y = from[1] * H
  const tx = to[0] * W
  const ty = to[1] * H
  const dx = tx - slot.x
  const dy = ty - slot.y
  const dist = Math.hypot(dx, dy) || 1
  const speed = 500 + Math.random() * 120
  slot.vx = (dx / dist) * speed
  slot.vy = (dy / dist) * speed
  slot.maxLife = dist / speed + 0.08
  slot.life = slot.maxLife
  slot.active = true
}

let _scriptBeat = -1

export function resetScriptedBeats() {
  _scriptBeat = -1
}

/** Fire moon → handoff → chat scripted shooters (click launch or manual). */
export function fireScriptedJourney(W, H) {
  const st = scriptedStarTargets
  resetScriptedBeats()
  spawnDirectedShooter(SHOOT_POOL[0], st.moon, st.handoff, W, H)
  _scriptBeat = 0
  setTimeout(() => {
    spawnDirectedShooter(SHOOT_POOL[1], st.handoff, st.chat, W, H)
    _scriptBeat = 1
  }, 120)
  setTimeout(() => {
    spawnDirectedShooter(SHOOT_POOL[2], st.moon, st.chat, W, H)
    _scriptBeat = 2
  }, 240)
}

/* ─── Build full star array (constellation + scattered) ─────── */
const TOTAL_STARS = 160
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

  /* Scattered background stars — extended z-range for longer warp travel */
  for (let i = 0; i < SCATTER_COUNT; i++) {
    stars.push({
      x: (rand() * 2 - 1) * 900,
      y: (rand() * 2 - 1) * 600,
      z: 80 + rand() * 1400,
      baseZ: 0,
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
const CAM_MAX = 1100  // increased for faster cinematic warp (was 620)

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
export default function ConstellationScene({ scrollProgress, launchToken = 0 }) {
  const canvasRef  = useRef(null)
  const mouseRef   = useRef({ x: -9999, y: -9999 })
  const rafRef     = useRef(null)
  const timeRef    = useRef(0)

  /* Camera Z driven by scroll: 0 → CAM_MAX */
  const cameraZ = useTransform(scrollProgress, [0, 1], [0, CAM_MAX])
  /* Constellation lines: visible in warp/features; off during moon/stars band */
  const constAlpha = useTransform(scrollProgress, [0, 0.08, STARS_PHASE_END, STARS_PHASE_END + 0.10], [0, 0, 0.72, 0.72])

  useEffect(() => {
    if (launchToken <= 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.offsetWidth || window.innerWidth
    const H = canvas.offsetHeight || window.innerHeight
    if (!W || !H) return
    fireScriptedJourney(W, H)
  }, [launchToken])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    /* Hoist context + projected array — created once, reused every frame.
       Must be declared before resize so resize can call ctx.setTransform. */
    const ctx       = canvas.getContext('2d')
    const projected = new Array(STARS.length)

    /* Resize canvas — cap devicePixelRatio at 1.5 to halve pixel work
       on retina screens without visible quality loss at this scale.
       ctx.setTransform is absolute (not additive) so repeated ResizeObserver
       firings never accumulate scale. */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const W   = canvas.offsetWidth
      const H   = canvas.offsetHeight
      canvas.width  = W * dpr   // resets the canvas transform
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      canvas.logicalW = W
      canvas.logicalH = H
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

      /* Use logical dimensions (pre-DPR) for all draw math */
      const W     = canvas.logicalW || canvas.offsetWidth
      const H     = canvas.logicalH || canvas.offsetHeight
      const cx    = W * 0.5
      const cy    = H * 0.5
      const camZ  = cameraZ.get()
      const cAlpha = constAlpha.get()
      const mx    = mouseRef.current.x
      const my    = mouseRef.current.y
      const t     = timeRef.current

      /* Camera origin offset: lerp from bottom-right toward center as
         scroll advances 0→0.25, giving the "starting from bottom-right"
         perspective that slowly centers as you fly inward */
      const sv = scrollProgress.get()
      const starFade = moonStoryStarFade(sv)
      /* Fade constellation mesh lines out below feature band when scrolling back */
      const trailBand = sv < STARS_PHASE_END ? Math.max(0, (sv - 0.26) / (STARS_PHASE_END - 0.26)) : 1
      const effAlpha = cAlpha * starFade * trailBand
      const originLerp = Math.max(0, 1 - sv / 0.25)
      const originX = originLerp * 320
      const originY = originLerp * 210

      ctx.clearRect(0, 0, W, H)

      /* Project all stars into reusable array (no allocation per frame) */
      for (let i = 0; i < STARS.length; i++) {
        const star = STARS[i]
        let z = star.z - camZ

        /* Wrap scattered stars when they pass the camera */
        if (!star.isNode) {
          if (z < 10) {
            star.z += 1400
            z = star.z - camZ
          }
        }

        const depth = Math.max(z, 1)
        const scale = FOCAL / depth

        /* Apply bottom-right origin offset to all projected coords */
        const sx = star.x * scale + cx + originX
        const sy = star.y * scale + cy + originY

        /* Twinkle */
        const twinkle = 0.6 + 0.4 * Math.sin(t * star.twinkleSpeed + star.twinkleOffset)
        const alpha   = star.brightness * twinkle

        /* Size grows as star gets closer */
        const r = star.size * scale * 0.55

        /* Cull stars outside viewport with a generous margin for the offset */
        const inView = sx > -400 && sx < W + 400 && sy > -300 && sy < H + 300 && depth < 1600

        projected[i] = { sx, sy, r: Math.max(r, 0.3), alpha, inView, depth }
      }

      /* ── Draw constellation lines ────────────────────────────── */
      if (effAlpha > 0.005) {
        ctx.save()
        ctx.lineWidth = 1.2

        for (const [a, b] of ALL_EDGES) {
          const pa = projected[a]
          const pb = projected[b]
          if (!pa || !pb || !pa.inView && !pb.inView) continue

          /* Depth-fade: lines closer to camera are slightly brighter */
          const avgDepth = (pa.depth + pb.depth) * 0.5
          const depthFade = Math.max(0, 1 - avgDepth / 900)
          const lineAlpha = effAlpha * (0.3 + 0.7 * depthFade)

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

      /* ── Draw stars (+ warp streaks for close scatter stars) ───── */
      /* vanishing-point is viewport center after offset correction */
      const vpx = cx + originX
      const vpy = cy + originY

      /* Draw scattered regular stars first (no shadow, no gradient halo) in
         one batched pass to minimise ctx state changes */
      ctx.shadowBlur = 0
      for (let i = 0; i < STARS.length; i++) {
        const p    = projected[i]
        const star = STARS[i]
        if (!p || !p.inView || p.r < 0.15 || star.isNode) continue

        const scatterAlpha = p.alpha * starFade
        if (scatterAlpha < 0.03) continue

        const warpT = camZ > 80
          ? Math.max(0, 1 - p.depth / 180) * Math.min((camZ - 80) / 260, 1)
          : 0

        if (warpT > 0.05) {
          /* Warp streak — radiates outward from vanishing point */
          const dx   = p.sx - vpx
          const dy   = p.sy - vpy
          const len  = Math.sqrt(dx * dx + dy * dy) || 1
          const nx   = dx / len
          const ny   = dy / len
          const tail = p.r * (1 + warpT * 18)
          const x0   = p.sx - nx * tail
          const y0   = p.sy - ny * tail
          const grad = ctx.createLinearGradient(x0, y0, p.sx, p.sy)
          grad.addColorStop(0, 'rgba(200,235,255,0)')
          grad.addColorStop(1, `rgba(220,242,255,${scatterAlpha * (0.4 + warpT * 0.6)})`)
          ctx.strokeStyle = grad
          ctx.lineWidth   = Math.max(p.r * 0.7, 0.4)
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(p.sx, p.sy)
          ctx.stroke()
        } else {
          /* Regular dot — batch into single fillStyle where possible */
          ctx.fillStyle = `rgba(220,240,255,${scatterAlpha})`
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      /* Draw constellation nodes second (radial gradient halos) */
      if (effAlpha > 0.01) {
        for (let i = 0; i < STARS.length; i++) {
          const p    = projected[i]
          const star = STARS[i]
          if (!p || !p.inView || p.r < 0.15 || !star.isNode) continue

          const haloR = p.r * 4.5
          const halo  = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, haloR)
          halo.addColorStop(0, `rgba(45,212,191,${p.alpha * 0.35 * effAlpha})`)
          halo.addColorStop(1, 'rgba(45,212,191,0)')
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, haloR, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = `rgba(200,248,250,${p.alpha * starFade})`
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, p.r * 1.15, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      /* ── Shooting stars ─────────────────────────────────────── */
      const dt = _lastShootTs > 0 ? Math.min((timestamp - _lastShootTs) / 1000, 0.05) : 0
      _lastShootTs = timestamp

      const inStarBridge = sv >= STARS_PHASE_START && sv < STARS_PHASE_END
      if (inStarBridge) {
        const local = (sv - STARS_PHASE_START) / (STARS_PHASE_END - STARS_PHASE_START)
        const st = scriptedStarTargets
        if (local > 0.08 && _scriptBeat < 0) {
          spawnDirectedShooter(SHOOT_POOL[0], st.moon, st.handoff, W, H)
          _scriptBeat = 0
        }
        if (local > 0.38 && _scriptBeat < 1) {
          spawnDirectedShooter(SHOOT_POOL[1], st.handoff, st.chat, W, H)
          _scriptBeat = 1
        }
        if (local > 0.62 && _scriptBeat < 2) {
          spawnDirectedShooter(SHOOT_POOL[2], st.moon, st.chat, W, H)
          _scriptBeat = 2
        }
      } else if (sv < STARS_PHASE_START - 0.02 || sv > STARS_PHASE_END + 0.02) {
        _scriptBeat = -1
      }

      for (let si = 0; si < SHOOT_POOL.length; si++) {
        const s = SHOOT_POOL[si]

        if (!s.active) {
          /* Count down to next firing */
          s.nextFire -= dt * 1000
          const interval = inStarBridge ? 900 + Math.random() * 700 : 3500 + Math.random() * 4000
          if (s.nextFire <= 0) {
            spawnShooter(s, W, H)
            s.nextFire = interval
          }
          continue
        }

        /* Advance position */
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.life -= dt

        if (s.life <= 0 || s.x > W + 50 || s.y > H + 50) {
          s.active = false
          continue
        }

        /* Draw streak: gradient from transparent tail to bright head */
        const lifeRatio  = s.life / s.maxLife
        const headAlpha  = Math.min(lifeRatio * 2, 1) * 0.88 * Math.max(starFade, 0.35)
        const tailLength = 90 + (1 - lifeRatio) * 60
        const tx = s.x - (s.vx / Math.hypot(s.vx, s.vy)) * tailLength
        const ty = s.y - (s.vy / Math.hypot(s.vx, s.vy)) * tailLength

        const shootGrad = ctx.createLinearGradient(tx, ty, s.x, s.y)
        shootGrad.addColorStop(0,   'rgba(255,255,255,0)')
        shootGrad.addColorStop(0.6, `rgba(220,240,255,${(headAlpha * 0.4).toFixed(2)})`)
        shootGrad.addColorStop(1,   `rgba(255,255,255,${headAlpha.toFixed(2)})`)

        ctx.save()
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(s.x, s.y)
        ctx.strokeStyle = shootGrad
        ctx.lineWidth   = 1.2
        ctx.shadowBlur  = 6
        ctx.shadowColor = 'rgba(200,240,255,0.7)'
        ctx.stroke()
        ctx.shadowBlur  = 0

        /* Bright head dot */
        ctx.beginPath()
        ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${headAlpha.toFixed(2)})`
        ctx.fill()
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
