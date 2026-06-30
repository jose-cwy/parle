/**
 * Split text into plain and **bold** segments. Only parses bold — no other markdown.
 */
function parseBoldSegments(text) {
  const raw = String(text ?? '')
  if (!raw.includes('**')) {
    return [{ type: 'text', value: raw }]
  }

  const segments = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: raw.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'bold', value: match[1] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < raw.length) {
    segments.push({ type: 'text', value: raw.slice(lastIndex) })
  }

  return segments.length ? segments : [{ type: 'text', value: raw }]
}

module.exports = {
  parseBoldSegments,
}
