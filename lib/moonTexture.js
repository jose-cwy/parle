/**
 * Procedural lunar albedo — seeded noise + maria blobs, cached per size.
 * Original texture; not derived from reference photo pixels.
 */

let _cache = { w: 0, h: 0, canvas: null }

function seededRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s >>> 0) / 0xffffffff
  }
}

function buildAlbedoCanvas(size) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  const rand = seededRng(0x6d6f6f6e)
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.48

  /* Base highlands */
  const base = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.15, 0, cx, cy, r)
  base.addColorStop(0, '#e8eaef')
  base.addColorStop(0.5, '#c8ccd4')
  base.addColorStop(1, '#9aa0ac')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  /* Fine grain */
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 28
    d[i] = Math.min(255, Math.max(0, d[i] + n))
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n))
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n))
  }
  ctx.putImageData(img, 0, 0)

  /* Maria blobs */
  const maria = [
    [0.05, -0.12, 0.28, 0.22], [-0.3, 0.1, 0.2, 0.16], [0.28, 0.2, 0.14, 0.12],
    [-0.1, -0.3, 0.16, 0.13], [0.15, 0.05, 0.12, 0.1], [-0.35, -0.05, 0.11, 0.09],
    [0.32, -0.08, 0.1, 0.08], [-0.18, 0.28, 0.13, 0.11],
  ]
  for (const [ox, oy, rx, ry] of maria) {
    const px = cx + ox * r
    const py = cy + oy * r
    const g = ctx.createRadialGradient(px, py, 0, px, py, r * Math.max(rx, ry))
    g.addColorStop(0, 'rgba(70, 75, 88, 0.55)')
    g.addColorStop(0.55, 'rgba(90, 95, 108, 0.28)')
    g.addColorStop(1, 'rgba(90, 95, 108, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(px, py, r * rx, r * ry, rand() * 0.5, 0, Math.PI * 2)
    ctx.fill()
  }

  /* Soft blur pass for painterly maria edges */
  ctx.filter = 'blur(3px)'
  ctx.globalAlpha = 0.35
  ctx.drawImage(c, 0, 0)
  ctx.filter = 'none'
  ctx.globalAlpha = 1

  return c
}

/** Get or rebuild cached albedo; size should be ~2× moon diameter in px */
export function getMoonAlbedoCanvas(diameterPx) {
  if (typeof document === 'undefined') return null
  const size = Math.max(128, Math.min(512, Math.ceil(diameterPx * 2)))
  if (_cache.canvas && _cache.w === size) return _cache.canvas
  _cache = { w: size, h: size, canvas: buildAlbedoCanvas(size) }
  return _cache.canvas
}

export function invalidateMoonTexture() {
  _cache = { w: 0, h: 0, canvas: null }
}
