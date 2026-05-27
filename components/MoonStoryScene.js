import { useEffect, useRef } from 'react'
import { motion, useTransform, useReducedMotion } from 'framer-motion'
import { drawDetailedMoon } from '../lib/moonArt'
import { invalidateMoonTexture } from '../lib/moonTexture'
import { moonFloat, moonGlowPulse } from '../lib/motion'

export const MOON_PHASE_START = 0.10
export const MOON_PHASE_END   = 0.22
export const STARS_PHASE_START = 0.22
export const STARS_PHASE_END   = 0.34

export const TRAIL_HANDOFF = [0.50, 0.28]
export const THREAD_ANCHOR = TRAIL_HANDOFF

const MOON = { cx: 0.50, cy: 0.13 }
export const WHISPER_ANCHOR = [0.50, 0.58]

function moonLocalT(scroll) {
  if (scroll <= MOON_PHASE_START) return 0
  if (scroll >= MOON_PHASE_END) return 1
  return (scroll - MOON_PHASE_START) / (MOON_PHASE_END - MOON_PHASE_START)
}

function sceneVisible(scroll) {
  return scroll >= MOON_PHASE_START - 0.02 && scroll <= STARS_PHASE_END + 0.03
}

export function moonStoryStarFade(scroll) {
  if (scroll < MOON_PHASE_START) return 1
  if (scroll > STARS_PHASE_END) return 1
  if (scroll < 0.14) return 1 - (scroll - MOON_PHASE_START) / 0.04
  if (scroll > 0.26) return (scroll - 0.26) / 0.04
  return 0
}

export const heartbreakStarFade = moonStoryStarFade
export const HEARTBREAK_PHASE_START = MOON_PHASE_START
export const HEARTBREAK_PHASE_END = STARS_PHASE_END

function drawAmbientWash(ctx, W, H, mx, my, r, b) {
  const wash = ctx.createRadialGradient(mx, my, r * 0.3, mx, my, r * 2.2)
  wash.addColorStop(0, `rgba(220, 235, 255, ${0.06 * b})`)
  wash.addColorStop(0.4, `rgba(45, 212, 191, ${0.04 * b})`)
  wash.addColorStop(1, 'rgba(45, 212, 191, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, W, H)
}

function drawWhisperAnchor(ctx, ax, ay, alpha, pulse) {
  if (alpha <= 0.02) return
  const breathe = 0.85 + 0.15 * Math.sin(pulse * 2)
  const bloom = ctx.createRadialGradient(ax, ay, 0, ax, ay, 22 * breathe)
  bloom.addColorStop(0, `rgba(45,212,191,${alpha * 0.45 * breathe})`)
  bloom.addColorStop(0.5, `rgba(200,252,245,${alpha * 0.2 * breathe})`)
  bloom.addColorStop(1, 'rgba(45,212,191,0)')
  ctx.fillStyle = bloom
  ctx.beginPath()
  ctx.arc(ax, ay, 22 * breathe, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(ax, ay, 3.5, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(220,255,248,${alpha * 0.95})`
  ctx.shadowBlur = 10
  ctx.shadowColor = 'rgba(45,212,191,0.7)'
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawWhisperRipples(ctx, ax, ay, pulse, alpha, burst = 1) {
  if (alpha <= 0.02) return
  const ringCount = burst > 1 ? 6 : 4
  for (let i = 0; i < ringCount; i++) {
    const phase = (pulse * 0.55 + i * 0.25) % 1
    const radius = 14 + phase * (72 * burst)
    const ringAlpha = alpha * (1 - phase) * 0.42 * burst
    ctx.beginPath()
    ctx.arc(ax, ay, radius, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(45,212,191,${ringAlpha})`
    ctx.lineWidth = 1.2 - i * 0.15
    ctx.stroke()
  }
}

export default function MoonStoryScene({ scrollProgress, launchBurst = 0 }) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const scrollRef = useRef(0)
  const burstUntilRef = useRef(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (launchBurst > 0) {
      burstUntilRef.current = performance.now() + 700
    }
  }, [launchBurst])

  const opacity = useTransform(
    scrollProgress,
    [MOON_PHASE_START - 0.02, MOON_PHASE_START, STARS_PHASE_END, STARS_PHASE_END + 0.02],
    [0, 1, 1, 0]
  )

  const parallaxY = useTransform(
    scrollProgress,
    [MOON_PHASE_START, MOON_PHASE_END],
    reduceMotion ? [0, 0] : [6, -6]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
    const startTime = performance.now()

    const resize = () => {
      invalidateMoonTexture()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      canvas.logicalW = W
      canvas.logicalH = H
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      const W = canvas.logicalW || canvas.offsetWidth
      const H = canvas.logicalH || canvas.offsetHeight
      if (!W || !H) return

      const scroll = scrollRef.current
      if (!sceneVisible(scroll)) {
        ctx.clearRect(0, 0, W, H)
        return
      }

      ctx.clearRect(0, 0, W, H)

      const t = moonLocalT(scroll)
      const heartbreakVig = t < 0.4 ? 0.45 + (1 - t / 0.4) * 0.28 : 0.45 - Math.min((t - 0.4) / 0.6, 1) * 0.2
      const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.72)
      vig.addColorStop(0, 'rgba(2,9,20,0)')
      vig.addColorStop(1, `rgba(2,9,20,${heartbreakVig})`)
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, W, H)
      const inStars = scroll >= STARS_PHASE_START
      const moonIn = Math.min(t / 0.3, 1)
      const whisperT = Math.max(0, Math.min((t - 0.3) / 0.7, 1))
      const handT = Math.max(0, Math.min((t - 0.75) / 0.25, 1))

      const moonBright = 0.55 + moonIn * 0.2 + whisperT * 0.35 + (inStars ? 0.1 : 0)
      const mx = MOON.cx * W
      const my = MOON.cy * H
      const r = Math.min(W, H) * 0.16 * Math.max(moonBright, 0.75)
      const timeSec = (performance.now() - startTime) / 1000

      const ax = WHISPER_ANCHOR[0] * W
      const ay = WHISPER_ANCHOR[1] * H

      drawAmbientWash(ctx, W, H, mx, my, r, moonBright)
      drawDetailedMoon(ctx, mx, my, r, moonBright, reduceMotion ? 0 : timeSec)

      const inBurst = performance.now() < burstUntilRef.current
      const burstMul = inBurst ? 1.85 : 1
      const rippleAlpha = moonIn * (0.35 + whisperT * 0.65) * (inStars ? 1 - handT * 0.25 : 1) * burstMul
      if (!reduceMotion && rippleAlpha > 0.02) {
        drawWhisperRipples(ctx, ax, ay, timeSec * 1.4, rippleAlpha, burstMul)
      }
      drawWhisperAnchor(ctx, ax, ay, moonIn * (0.5 + whisperT * 0.5) * burstMul, timeSec * 2)

      if (inStars || handT > 0.3) {
        const hx = TRAIL_HANDOFF[0] * W
        const hy = TRAIL_HANDOFF[1] * H
        const a = inStars ? Math.min((scroll - STARS_PHASE_START) / 0.06, 1) : handT * 0.6
        const bloom = ctx.createRadialGradient(hx, hy, 0, hx, hy, 28)
        bloom.addColorStop(0, `rgba(45,212,191,${a * 0.45})`)
        bloom.addColorStop(1, 'rgba(45,212,191,0)')
        ctx.fillStyle = bloom
        ctx.beginPath()
        ctx.arc(hx, hy, 28, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      draw()
    }
    rafRef.current = requestAnimationFrame(loop)

    const unsub = scrollProgress.on('change', v => { scrollRef.current = v })
    return () => {
      unsub()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [scrollProgress, reduceMotion, launchBurst])

  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 25,
        opacity,
      }}
      aria-hidden="true"
    >
      {!reduceMotion && (
        <motion.div
          className="moon-halo"
          {...moonGlowPulse}
        />
      )}
      <motion.canvas
        ref={canvasRef}
        {...(reduceMotion ? {} : moonFloat)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          y: parallaxY,
        }}
      />
    </motion.div>
  )
}
