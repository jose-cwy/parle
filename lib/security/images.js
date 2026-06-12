const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const SIGNATURES = [
  { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { type: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: 'image/gif', bytes: [0x47, 0x49, 0x46] },
]

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl || '')
  const match = raw.match(/^data:([^;]+);base64,(.+)$/i)
  if (!match) return null

  try {
    const buffer = Buffer.from(match[2], 'base64')
    return { mime: match[1].toLowerCase(), buffer }
  } catch {
    return null
  }
}

function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null

  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => buffer[i] === b)) {
      return sig.type
    }
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

/**
 * Validate client image payloads (magic bytes + size).
 * Images are not persisted server-side; re-encoded data URLs are passed to the AI API only.
 */
function validateImageDataUrls(images) {
  if (!Array.isArray(images)) return { ok: true, images: [] }

  const valid = []
  for (const item of images.slice(0, 2)) {
    const parsed = parseDataUrl(item)
    if (!parsed) {
      return { ok: false, error: 'Invalid image data' }
    }
    if (parsed.buffer.length > MAX_IMAGE_BYTES) {
      return { ok: false, error: 'Image too large' }
    }
    const detected = detectImageType(parsed.buffer)
    if (!detected) {
      return { ok: false, error: 'Unsupported image type' }
    }
    const safeDataUrl = `data:${detected};base64,${parsed.buffer.toString('base64')}`
    valid.push(safeDataUrl)
  }

  return { ok: true, images: valid }
}

module.exports = {
  MAX_IMAGE_BYTES,
  validateImageDataUrls,
}
