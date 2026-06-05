function safeTrim(value, max = 1200) {
  const t = String(value || '').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

const MOOD_LABELS = {
  miss: 'I miss them',
  text: 'I want to text them',
  alone: 'I feel alone',
  vent: 'I just want to vent',
  understand: 'Help me understand what happened',
  advice: 'I need advice',
  truth: 'I need harsh truth',
}

const STYLE_LABELS = {
  listen: 'Just listen',
  comfort: 'Comfort me first',
  comfort_then_advice: 'Advice after comfort',
  honest: 'Give me the honest truth',
  dont_text: 'Stop me from texting them',
}

/**
 * Few-shot examples teach the model what a "good" reply looks like.
 * Add more pairs here as you test real conversations.
 */
const REPLY_EXAMPLES = `
Example (good):
User: "I miss her so much and I keep checking her profile."
Assistant: "Yeah, that kind of missing hits differently when checking her profile becomes a habit. It's not just her you miss — it's the routine of having her there. Do you want me to just sit with you in this feeling for a bit, or help you stop checking tonight?"

Example (bad — do NOT do this):
- Long essay with 7 tips
- "As an AI language model..."
- "You should seek therapy" (unless safety)
- Generic: "Time heals all wounds"
`

function sentenceClamp(text, maxSentences = 5) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  const cleaned = raw.replace(/\n{3,}/g, '\n\n').trim()
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length <= maxSentences) return cleaned
  return parts.slice(0, maxSentences).join(' ')
}

function buildSystemPrompt({ mood, style, memorySummary }) {
  const moodLabel = mood ? MOOD_LABELS[mood] || mood : ''
  const styleLabel = style ? STYLE_LABELS[style] || style : ''

  const styleRules = [
    'You are Heartstrings Club: private heartbreak support. Not therapy, not medical advice.',
    'Default: short, emotionally natural messages. Avoid essays.',
    'Do not sound robotic. Avoid clichés and generic advice.',
    'Listen first. Validate feelings before advice.',
    'Ask before giving advice unless the user explicitly asked for advice/harsh truth.',
    'Reply in 2–5 sentences by default.',
    'Structure: (1) short validation (2) specific reflection (3) one gentle question or a small next step.',
    'No lists unless user asks.',
  ]

  if (style === 'listen') {
    styleRules.push('Do not give advice. Focus on presence, reflection, and a gentle question.')
  }
  if (style === 'comfort') {
    styleRules.push('Comfort first. Do not rush into solutions.')
  }
  if (style === 'comfort_then_advice') {
    styleRules.push('Comfort first, then one small practical next step only if appropriate.')
  }
  if (style === 'honest' || style === 'truth') {
    styleRules.push('Be honest and direct, but never cruel. Keep it short.')
  }
  if (style === 'dont_text' || mood === 'text') {
    styleRules.push(
      'Prioritize no-contact support: help them pause, explore what they want to send, offer an unsent message alternative, and a small next step for tonight.',
    )
  }

  const contextBits = []
  if (moodLabel) contextBits.push(`User_selected_mood: ${moodLabel}`)
  if (styleLabel) contextBits.push(`User_selected_response_style: ${styleLabel}`)
  if (memorySummary) contextBits.push(`Remembered_context: ${safeTrim(memorySummary, 600)}`)

  return [
    styleRules.join('\n'),
    `\n${REPLY_EXAMPLES}`,
    contextBits.length ? `\nContext:\n${contextBits.join('\n')}` : '',
  ]
    .join('\n')
    .trim()
}

module.exports = {
  buildSystemPrompt,
  sentenceClamp,
}

function buildReflectionPrompt({ mood, style, transcript }) {
  const moodLabel = mood ? MOOD_LABELS[mood] || mood : ''
  const styleLabel = style ? STYLE_LABELS[style] || style : ''

  const instructions = [
    'You write a private reflection for a heartbreak support app.',
    'Do not sound clinical or like therapy.',
    'Be concise and emotionally human.',
    'Return plain text only (no markdown headings).',
    'Format strictly as 5 short labeled lines:',
    'Mood: ...',
    'Trigger: ...',
    'Feeling: ...',
    'Needed: ...',
    'Reminder: ...',
  ]

  const context = [
    moodLabel ? `Selected mood: ${moodLabel}` : '',
    styleLabel ? `Preferred style: ${styleLabel}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return [
    instructions.join('\n'),
    context ? `\nContext:\n${context}` : '',
    '\nTranscript (most recent last):\n' + safeTrim(transcript, 1800),
  ]
    .join('\n')
    .trim()
}

module.exports.buildReflectionPrompt = buildReflectionPrompt

