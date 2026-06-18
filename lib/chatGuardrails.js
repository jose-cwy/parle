const OUT_OF_SCOPE_PATTERNS = [
  // Code requests
  /write.{0,20}(html|css|javascript|js|python|code|function|script|component|snippet)/i,
  /debug.{0,20}(code|error|bug)/i,
  /help.{0,15}debug/i,
  /debug.{0,20}(my|this|the|a|your).{0,20}(javascript|js|code|python|html|css)/i,
  /(html|css|javascript|python|react|node|sql).{0,20}(code|example|snippet|template)/i,
  /how.{0,20}(code|program|build|develop|create).{0,20}(app|website|page|component)/i,

  // Food and places
  /find.{0,20}(restaurant|cafe|food|place|hotel|shop|store|near me)/i,
  /recommend.{0,20}(restaurant|cafe|food|place|hotel)/i,
  /where.{0,20}(eat|stay|go|find).{0,20}(in|near|around)/i,
  /best.{0,20}(restaurant|cafe|food|place).{0,20}(in|near)/i,

  // Directions
  /how.{0,20}(get|travel|go).{0,20}(to|from)/i,
  /directions.{0,20}(to|from)/i,

  // Homework and research
  /write.{0,20}(essay|report|assignment|summary|article)/i,
  /summaris|summariz.{0,10}(this|the|article|book|document)/i,
  /translate.{0,20}(this|the|document|text|paragraph)/i,
]

const ALWAYS_BLOCK_PATTERNS = [
  /write.{0,30}(essay|report|assignment|summary|article)/i,
  /summaris|summariz/i,
  /translate.{0,20}(this|the|document|text|paragraph)/i,
  /find.{0,20}(restaurant|cafe|food|place|hotel|shop|store|near me)/i,
  /recommend.{0,20}(restaurant|cafe|food|place|hotel)/i,
  /where.{0,20}(eat|stay|go|find).{0,20}(in|near|around)/i,
  /best.{0,20}(restaurant|cafe|food|place).{0,20}(in|near)/i,
  /how.{0,20}(get|travel|go).{0,20}(to|from)/i,
  /directions.{0,20}(to|from)/i,
  /write.{0,20}(html|css|javascript|js|python|code|function|script|component|snippet)/i,
  /debug.{0,20}(code|error|bug)/i,
  /help.{0,15}debug/i,
]

const EMOTIONAL_KEYWORDS =
  /\b(miss|feel|hurt|lonely|sad|angry|cry|cried|love|heartbreak|relationship|breakup|broke up|alone|lost|scared|worried|anxious|happy|confused|numb|empty|tired|exhausted|overwhelmed)\b/i

const REDIRECT_RESPONSES = [
  "that's not really my space — i'm here for the emotional stuff, not the technical. what's going on with you today?",
  "finding spots isn't my thing — but if something's on your mind, i'm here for it.",
  "i'm not the right tool for that one. i'm here if you want to talk about something more personal.",
  "that's a bit outside what i do — i'm built for the feelings side of things. is there something on your mind?",
]

export function getRedirectResponse(message) {
  const lower = String(message || '').toLowerCase()

  if (/html|css|javascript|python|code|function|script|debug/i.test(lower)) {
    return REDIRECT_RESPONSES[0]
  }

  if (/restaurant|cafe|food|hotel|directions|near me/i.test(lower)) {
    return REDIRECT_RESPONSES[1]
  }

  if (/essay|assignment|summaris|summariz|translate/i.test(lower)) {
    return REDIRECT_RESPONSES[2]
  }

  return REDIRECT_RESPONSES[3]
}

export function isOutOfScope(message) {
  const text = String(message || '').trim()
  if (!text || text.length < 3) return false

  const matches = OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(text))
  if (!matches) return false

  if (ALWAYS_BLOCK_PATTERNS.some((pattern) => pattern.test(text))) {
    return true
  }

  if (EMOTIONAL_KEYWORDS.test(text)) return false

  return true
}
