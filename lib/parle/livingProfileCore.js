const crypto = require('crypto')

const MIN_HITS = 2
const MIN_INJECT_CONFIDENCE = 0.45
const MAX_FACTS = 24
const MAX_INJECT_FACTS = 12
const FADE_AFTER_MS = 45 * 24 * 60 * 60 * 1000
const NAME_PATTERN_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000

const SENSITIVE_RE =
  /\b(depress(?:ed|ion)?|anxi(?:ous|ety)|ptsd|suicid(?:al|e)?|self[-\s]?harm|bipolar|schizophren|adhd|autis(?:m|tic)|anorex|bulimi|eating\s+disorder|diagnos(?:is|ed)|medication|ssri|antidepressant|sexual|sexually|std|hiv|pregnant|pregnancy)\b/i

const CATEGORY_LABELS = {
  communication: 'How you write',
  whatWorks: 'What helps',
  situation: 'People & situation',
  pattern: 'Patterns',
  rhythm: 'When you tend to write',
  direction: 'How things have been going',
}

function emptyProfile() {
  return {
    version: 1,
    facts: [],
    derived: {
      replyLength: 'medium',
      tone: 'balanced',
      questionsOk: true,
      preferValidation: true,
    },
  }
}

function isSensitiveText(text) {
  return SENSITIVE_RE.test(String(text || ''))
}

function sanitizeFactText(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180)
  if (!value || isSensitiveText(value)) return null
  return value
}

function createFact({ category, key, text, confidence = 0.34, now = Date.now() }) {
  const clean = sanitizeFactText(text)
  if (!clean) return null
  return {
    id: crypto.randomUUID(),
    category,
    key: String(key || clean).slice(0, 80),
    text: clean,
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0.34)),
    count: 1,
    lastSeen: now,
    lastNamedAt: 0,
  }
}

function bumpFact(profile, { category, key, text, confidence = 0.2, now = Date.now() }) {
  const next = profile.facts ? [...profile.facts] : []
  const existing = next.find((f) => f.key === key && f.category === category)
  const clean = sanitizeFactText(text)
  if (!clean) {
    if (existing) {
      return {
        ...profile,
        facts: next.filter((f) => f.id !== existing.id),
      }
    }
    return profile
  }

  if (existing) {
    existing.count += 1
    existing.confidence = Math.min(1, existing.confidence + confidence)
    existing.lastSeen = now
    existing.text = clean
    return { ...profile, facts: next }
  }

  const fact = createFact({ category, key, text: clean, confidence, now })
  if (!fact) return profile
  next.push(fact)
  return { ...profile, facts: next }
}

function removeContradictedFacts(profile, keys) {
  const drop = new Set((keys || []).map(String))
  return {
    ...profile,
    facts: (profile.facts || []).filter((f) => !drop.has(f.key)),
  }
}

function deleteFactById(profile, id) {
  return {
    ...profile,
    facts: (profile.facts || []).filter((f) => f.id !== id),
  }
}

function fadeAndCap(profile, now = Date.now()) {
  const facts = (profile.facts || [])
    .map((f) => {
      if (now - (f.lastSeen || 0) > FADE_AFTER_MS) {
        return { ...f, confidence: Math.max(0, (f.confidence || 0) - 0.25) }
      }
      return f
    })
    .filter((f) => (f.confidence || 0) >= 0.2 && !isSensitiveText(f.text))
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, MAX_FACTS)

  return { ...profile, facts }
}

function hourBucket(hour) {
  const h = Number(hour)
  if (!Number.isFinite(h)) return null
  if (h >= 22 || h < 5) return 'late_night'
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function overlayPreferenceKnobs(profile, preferenceProfile) {
  const base = profile || emptyProfile()
  if (!preferenceProfile) return base
  const derived = { ...(base.derived || emptyProfile().derived) }
  if (preferenceProfile.preferred_response_length) {
    derived.replyLength = preferenceProfile.preferred_response_length
  }
  if (preferenceProfile.preferred_tone) {
    derived.tone = preferenceProfile.preferred_tone
  }
  if (typeof preferenceProfile.responds_well_to_questions === 'boolean') {
    derived.questionsOk = preferenceProfile.responds_well_to_questions
  }
  if (typeof preferenceProfile.prefers_validation_over_advice === 'boolean') {
    derived.preferValidation = preferenceProfile.prefers_validation_over_advice
  }
  return { ...base, derived }
}

function mergeSessionSignals(profile, signals = {}, hour, now = Date.now()) {
  let next = { ...emptyProfile(), ...profile, facts: [...(profile.facts || [])] }
  const avgLen = Number(signals.user_avg_message_length) || 0
  if (avgLen > 0 && avgLen < 80) {
    next = bumpFact(next, {
      category: 'communication',
      key: 'write_length',
      text: 'You often write in short messages.',
      confidence: 0.28,
      now,
    })
  } else if (avgLen > 200) {
    next = bumpFact(next, {
      category: 'communication',
      key: 'write_length',
      text: 'You often write in longer messages.',
      confidence: 0.28,
      now,
    })
  }

  const finalMode = signals.final_mode
  if (finalMode) {
    next = bumpFact(next, {
      category: 'whatWorks',
      key: `mode:${String(finalMode).slice(0, 48)}`,
      text: `You often stay in ${finalMode}.`,
      confidence: 0.28,
      now,
    })
  }

  if (signals.repeat_sentiment_detected) {
    next = bumpFact(next, {
      category: 'pattern',
      key: 'pattern:repeat_loop',
      text: 'The same worry tends to come back in a conversation.',
      confidence: 0.28,
      now,
    })
  }

  const bucket = hourBucket(hour)
  if (bucket === 'late_night') {
    next = bumpFact(next, {
      category: 'rhythm',
      key: 'rhythm:late_night',
      text: 'You often write late at night.',
      confidence: 0.28,
      now,
    })
  }

  const derived = { ...(next.derived || emptyProfile().derived) }
  if (signals.preferred_response_length) derived.replyLength = signals.preferred_response_length
  if (signals.preferred_tone) derived.tone = signals.preferred_tone
  if (typeof signals.responds_well_to_questions === 'boolean') {
    derived.questionsOk = signals.responds_well_to_questions
  }
  if (typeof signals.prefers_validation_over_advice === 'boolean') {
    derived.preferValidation = signals.prefers_validation_over_advice
  }
  next.derived = derived
  return fadeAndCap(next, now)
}

function mergeFeedbackSignals(profile, feedbackRows = [], now = Date.now()) {
  let next = profile
  for (const row of (feedbackRows || []).slice(0, 6)) {
    const rating = String(row.rating || '').toLowerCase()
    if (rating !== 'up') continue
    const excerpt = sanitizeFactText(row.reply_excerpt)
    if (!excerpt) continue
    next = bumpFact(next, {
      category: 'whatWorks',
      key: `works:${excerpt.toLowerCase().slice(0, 40)}`,
      text: 'You tend to like replies that stay specific and close to what you said.',
      confidence: 0.28,
      now,
    })
  }
  return fadeAndCap(next, now)
}

function mergeExtractedFacts(profile, extracted = {}, now = Date.now()) {
  let next = { ...emptyProfile(), ...profile, facts: [...(profile.facts || [])] }
  const people = Array.isArray(extracted.people) ? extracted.people : []
  for (const person of people.slice(0, 6)) {
    const label = sanitizeFactText(person)
    if (!label) continue
    next = bumpFact(next, {
      category: 'situation',
      key: `person:${label.toLowerCase()}`,
      text: `Someone you talk about as ${label}.`,
      confidence: 0.22,
      now,
    })
  }

  if (extracted.stage) {
    const stage = sanitizeFactText(extracted.stage)
    if (stage) {
      next = bumpFact(next, {
        category: 'situation',
        key: 'situation:stage',
        text: stage,
        confidence: 0.2,
        now,
      })
    }
  }

  if (extracted.timeline) {
    const timeline = sanitizeFactText(extracted.timeline)
    if (timeline) {
      next = bumpFact(next, {
        category: 'situation',
        key: 'situation:timeline',
        text: timeline,
        confidence: 0.2,
        now,
      })
    }
  }

  if (extracted.direction) {
    const direction = sanitizeFactText(extracted.direction)
    if (direction) {
      next = bumpFact(next, {
        category: 'direction',
        key: 'direction:arc',
        text: direction,
        confidence: 0.28,
        now,
      })
    }
  }

  const patterns = Array.isArray(extracted.patterns) ? extracted.patterns : []
  for (const pattern of patterns.slice(0, 6)) {
    const text = sanitizeFactText(pattern)
    if (!text) continue
    next = bumpFact(next, {
      category: 'pattern',
      key: `pattern:${text.toLowerCase().slice(0, 40)}`,
      text,
      confidence: 0.2,
      now,
    })
  }

  const contradicted = Array.isArray(extracted.contradictedKeys) ? extracted.contradictedKeys : []
  if (contradicted.length) next = removeContradictedFacts(next, contradicted)

  return fadeAndCap(next, now)
}

function factsForInjection(profile, { talkMode = false } = {}) {
  const allowed = talkMode
    ? new Set(['communication', 'rhythm'])
    : new Set(['communication', 'whatWorks', 'situation', 'pattern', 'rhythm', 'direction'])

  return (profile.facts || [])
    .filter(
      (f) =>
        allowed.has(f.category) &&
        (f.count || 0) >= MIN_HITS &&
        (f.confidence || 0) >= MIN_INJECT_CONFIDENCE &&
        !isSensitiveText(f.text),
    )
    .slice(0, MAX_INJECT_FACTS)
}

function pickPatternToName(profile, now = Date.now()) {
  return (profile.facts || []).find(
    (f) =>
      f.category === 'pattern' &&
      (f.count || 0) >= MIN_HITS &&
      (f.confidence || 0) >= 0.6 &&
      now - (f.lastNamedAt || 0) > NAME_PATTERN_COOLDOWN_MS,
  )
}

function markPatternNamed(profile, factId, now = Date.now()) {
  return {
    ...profile,
    facts: (profile.facts || []).map((f) =>
      f.id === factId ? { ...f, lastNamedAt: now } : f,
    ),
  }
}

function buildLivingProfileBlock(profile, { talkMode = false, namingFact = null } = {}) {
  if (!profile) return ''
  const facts = factsForInjection(profile, { talkMode })
  const derived = profile.derived || emptyProfile().derived
  const lines = facts.map((f) => `- ${f.text}`)

  if (!talkMode) {
    lines.unshift(
      `- Reply length: ${derived.replyLength || 'medium'}`,
      `- Tone: ${derived.tone || 'balanced'}`,
      `- Questions: ${derived.questionsOk === false ? 'prefer fewer questions' : 'questions ok when useful'}`,
      `- Validation vs honesty: ${derived.preferValidation === false ? 'open to direct honesty' : 'often wants to feel heard first'}`,
    )
  }

  if (!lines.length) return ''

  const namingLine =
    !talkMode && namingFact
      ? `You may once, gently, name this pattern as an observation not a diagnosis: "${namingFact.text}". Never say profile, learned, or remembered settings.`
      : 'Do not name patterns this turn unless it truly fits. Never mention a profile or that you stored anything.'

  return `[PRIVATE ATTENTION — not visible to user]
Use this as quiet context from past conversations. Never mention a profile, memory system, or that you stored anything.
If today contradicts this, follow today.
${lines.join('\n')}
${namingLine}`
}

function toPublicItems(profile) {
  const groups = {}
  for (const fact of profile.facts || []) {
    if ((fact.count || 0) < MIN_HITS && (fact.confidence || 0) < MIN_INJECT_CONFIDENCE) continue
    const label = CATEGORY_LABELS[fact.category] || 'Other'
    if (!groups[label]) groups[label] = []
    groups[label].push({ id: fact.id, category: fact.category, text: fact.text })
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

module.exports = {
  MIN_HITS,
  MIN_INJECT_CONFIDENCE,
  emptyProfile,
  isSensitiveText,
  sanitizeFactText,
  createFact,
  bumpFact,
  removeContradictedFacts,
  deleteFactById,
  fadeAndCap,
  hourBucket,
  overlayPreferenceKnobs,
  mergeSessionSignals,
  mergeFeedbackSignals,
  mergeExtractedFacts,
  factsForInjection,
  pickPatternToName,
  markPatternNamed,
  buildLivingProfileBlock,
  toPublicItems,
  CATEGORY_LABELS,
}
