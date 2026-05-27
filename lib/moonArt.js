/** Detailed stylized moon — grey lunar surface, craters, rays, atmospheric glow */

import { getMoonAlbedoCanvas } from './moonTexture'

function moonOutlinePath(ctx, mx, my, r) {
  const n = 32
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const wobble = 1 + Math.sin(a * 6 + 0.3) * 0.014 + Math.cos(a * 4) * 0.01
    const px = mx + Math.cos(a) * r * wobble
    const py = my + Math.sin(a) * r * wobble
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/** Normalized crater catalog: ox, oy, radius, depth, hasRays */
const CRATERS = [
  [0.12, -0.2, 0.09, 0.5, false], [-0.25, 0.15, 0.07, 0.45, false],
  [0.3, 0.18, 0.06, 0.4, false], [-0.08, -0.35, 0.08, 0.55, false],
  [0.22, -0.05, 0.05, 0.35, false], [-0.32, -0.1, 0.055, 0.42, false],
  [0.05, 0.28, 0.065, 0.48, false], [-0.18, -0.15, 0.04, 0.3, false],
  [0.35, -0.22, 0.045, 0.38, false], [-0.12, 0.32, 0.05, 0.4, false],
  [0.18, 0.32, 0.04, 0.32, false], [-0.28, -0.28, 0.035, 0.28, false],
  [0.42, 0.05, 0.035, 0.3, false], [-0.38, 0.05, 0.04, 0.35, false],
  [0.08, 0.08, 0.03, 0.25, false], [-0.05, -0.08, 0.025, 0.22, false],
  /* Ray source — lower-right like reference */
  [0.38, 0.32, 0.11, 0.65, true],
  [0.28, 0.38, 0.07, 0.5, true],
]

const RAY_ORIGINS = [
  { ox: 0.38, oy: 0.32, count: 16, spread: 0.9 },
  { ox: 0.28, oy: 0.38, count: 10, spread: 0.5 },
]

function drawCraterBowl(ctx, mx, my, r, ox, oy, cr, depth, b) {
  const px = mx + ox * r
  const py = my + oy * r
  const rad = cr * r

  ctx.save()
  const bowl = ctx.createRadialGradient(px, py, 0, px, py, rad)
  bowl.addColorStop(0, `rgba(55, 58, 68, ${depth * 0.7 * b})`)
  bowl.addColorStop(0.55, `rgba(85, 90, 102, ${depth * 0.35 * b})`)
  bowl.addColorStop(1, 'rgba(85, 90, 102, 0)')
  ctx.fillStyle = bowl
  ctx.beginPath()
  ctx.arc(px, py, rad, 0, Math.PI * 2)
  ctx.fill()

  /* Bright rim */
  ctx.globalAlpha = 0.45 * b
  ctx.strokeStyle = 'rgba(230, 235, 245, 0.7)'
  ctx.lineWidth = Math.max(0.8, rad * 0.08)
  ctx.beginPath()
  ctx.arc(px, py, rad * 0.92, -0.8, 2.2)
  ctx.stroke()
  ctx.restore()
}

function drawRaySystem(ctx, mx, my, r, origin, b) {
  const ox = mx + origin.ox * r
  const oy = my + origin.oy * r
  const len = r * 1.1
  ctx.save()
  moonOutlinePath(ctx, mx, my, r)
  ctx.clip()
  for (let i = 0; i < origin.count; i++) {
    const baseAng = Math.PI * 0.35 + (i / origin.count) * origin.spread * Math.PI
    const ang = baseAng + (i % 3) * 0.04
    const ex = ox + Math.cos(ang) * len
    const ey = oy + Math.sin(ang) * len
    const fade = 1 - (i / origin.count) * 0.35
    const grad = ctx.createLinearGradient(ox, oy, ex, ey)
    grad.addColorStop(0, `rgba(220, 228, 240, ${0.5 * b * fade})`)
    grad.addColorStop(0.4, `rgba(200, 210, 225, ${0.2 * b * fade})`)
    grad.addColorStop(1, 'rgba(200, 210, 225, 0)')
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(ex, ey)
    ctx.strokeStyle = grad
    ctx.lineWidth = 0.6 + (i % 2) * 0.3
    ctx.stroke()
  }
  ctx.restore()
}

function drawHighlandSpeckle(ctx, mx, my, r, b) {
  ctx.save()
  moonOutlinePath(ctx, mx, my, r)
  ctx.clip()
  let s = 0x5aec41e
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 0xffffffff }
  for (let i = 0; i < 120; i++) {
    const ang = rnd() * Math.PI * 2
    const dist = rnd() * r * 0.88
    const px = mx + Math.cos(ang) * dist
    const py = my + Math.sin(ang) * dist
    const br = 0.15 + rnd() * 0.35
    ctx.globalAlpha = br * b * 0.4
    ctx.fillStyle = 'rgba(245, 248, 252, 0.9)'
    ctx.beginPath()
    ctx.arc(px, py, 0.4 + rnd() * 0.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawStarShape(ctx, x, y, size, style, alpha) {
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha * 0.5
  if (style === 'sparkle') {
    ctx.strokeStyle = 'rgba(255, 200, 150, 0.7)'
    ctx.lineWidth = size * 0.22
    ctx.beginPath()
    ctx.moveTo(0, -size)
    ctx.lineTo(0, size)
    ctx.moveTo(-size, 0)
    ctx.lineTo(size, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 210, 160, 0.6)'
    ctx.fill()
  } else {
    ctx.fillStyle = 'rgba(255, 200, 150, 0.55)'
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      const a2 = a + Math.PI / 5
      const ox = Math.cos(a) * size
      const oy = Math.sin(a) * size
      const ix = Math.cos(a2) * size * 0.4
      const iy = Math.sin(a2) * size * 0.4
      if (i === 0) ctx.moveTo(ox, oy)
      else ctx.lineTo(ox, oy)
      ctx.lineTo(ix, iy)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} mx
 * @param {number} my
 * @param {number} r
 * @param {number} brightness 0–1
 * @param {number} [timeSec] for subtle breathing
 * @param {number} [waningStrength] 0–1 shadow on disc (waning / absence)
 */
export function drawDetailedMoon(ctx, mx, my, r, brightness, timeSec = 0, waningStrength = 0) {
  const breathe = 0.92 + 0.08 * Math.sin(timeSec * 0.5)
  const b = brightness * breathe

  /* Outer atmospheric halo — teal/indigo dreamy */
  const outer = ctx.createRadialGradient(mx, my, r * 0.7, mx, my, r * 1.65)
  outer.addColorStop(0, `rgba(45, 212, 191, ${0.1 * b})`)
  outer.addColorStop(0.35, `rgba(99, 102, 241, ${0.05 * b})`)
  outer.addColorStop(1, 'rgba(99, 102, 241, 0)')
  ctx.fillStyle = outer
  ctx.beginPath()
  ctx.arc(mx, my, r * 1.65, 0, Math.PI * 2)
  ctx.fill()

  const innerGlow = ctx.createRadialGradient(mx, my, r * 0.5, mx, my, r * 1.15)
  innerGlow.addColorStop(0, `rgba(255, 252, 248, ${0.2 * b})`)
  innerGlow.addColorStop(1, 'rgba(255, 252, 248, 0)')
  ctx.fillStyle = innerGlow
  ctx.beginPath()
  ctx.arc(mx, my, r * 1.15, 0, Math.PI * 2)
  ctx.fill()

  /* Albedo texture clipped to disc */
  const albedo = getMoonAlbedoCanvas(r * 2)
  ctx.save()
  moonOutlinePath(ctx, mx, my, r)
  ctx.clip()
  if (albedo) {
    const pattern = ctx.createPattern(albedo, 'no-repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.translate(mx - r, my - r)
      ctx.fillRect(0, 0, r * 2, r * 2)
    }
  } else {
    const fallback = ctx.createRadialGradient(mx - r * 0.2, my - r * 0.15, 0, mx, my, r)
    fallback.addColorStop(0, `rgba(232, 234, 240, ${0.95 * b})`)
    fallback.addColorStop(0.6, `rgba(180, 186, 198, ${0.85 * b})`)
    fallback.addColorStop(1, `rgba(140, 148, 162, ${0.5 * b})`)
    ctx.fillStyle = fallback
    ctx.fill()
  }
  ctx.restore()

  /* Sphere shading overlay */
  ctx.save()
  moonOutlinePath(ctx, mx, my, r)
  ctx.clip()
  const term = ctx.createRadialGradient(mx - r * 0.2, my + r * 0.35, 0, mx, my, r * 1.1)
  term.addColorStop(0, `rgba(30, 35, 50, ${0.45 * b})`)
  term.addColorStop(0.5, 'rgba(30, 35, 50, 0)')
  ctx.fillStyle = term
  ctx.fillRect(mx - r, my - r, r * 2, r * 2)

  const rimHi = ctx.createRadialGradient(mx + r * 0.35, my - r * 0.35, 0, mx, my, r)
  rimHi.addColorStop(0, `rgba(255, 255, 252, ${0.28 * b})`)
  rimHi.addColorStop(0.45, 'rgba(255, 255, 252, 0)')
  ctx.fillStyle = rimHi
  ctx.fillRect(mx - r, my - r, r * 2, r * 2)
  ctx.restore()

  /* Ray systems (before small craters on top) */
  for (const origin of RAY_ORIGINS) {
    drawRaySystem(ctx, mx, my, r, origin, b)
  }

  /* Crater bowls */
  for (const [ox, oy, cr, depth, hasRays] of CRATERS) {
    if (!hasRays) drawCraterBowl(ctx, mx, my, r, ox, oy, cr, depth, b)
    else drawCraterBowl(ctx, mx, my, r, ox, oy, cr, depth * 1.1, b)
  }

  drawHighlandSpeckle(ctx, mx, my, r, b)

  /* Limb edge */
  ctx.strokeStyle = `rgba(200, 210, 225, ${0.2 * b})`
  ctx.lineWidth = 1.2
  moonOutlinePath(ctx, mx, my, r)
  ctx.stroke()

  /* Dim decorative stars */
  const starR = r * 0.14
  const stars = [
    { ox: -1.2, oy: -1.0, size: starR * 0.7, style: 'five' },
    { ox: 1.15, oy: -0.9, size: starR * 0.55, style: 'sparkle' },
  ]
  for (const s of stars) {
    drawStarShape(ctx, mx + s.ox * r, my + s.oy * r, s.size, s.style, 0.6 * b)
  }

  /* Waning shadow — romantic absence, confusion phase */
  if (waningStrength > 0.02) {
    ctx.save()
    moonOutlinePath(ctx, mx, my, r)
    ctx.clip()
    const shadow = ctx.createRadialGradient(mx + r * 0.35, my, r * 0.1, mx + r * 0.2, my, r * 1.05)
    shadow.addColorStop(0, `rgba(12, 18, 32, ${0.55 * waningStrength * b})`)
    shadow.addColorStop(0.55, `rgba(20, 28, 45, ${0.35 * waningStrength * b})`)
    shadow.addColorStop(1, 'rgba(20, 28, 45, 0)')
    ctx.fillStyle = shadow
    ctx.fillRect(mx - r, my - r, r * 2, r * 2)
    ctx.restore()
  }
}
