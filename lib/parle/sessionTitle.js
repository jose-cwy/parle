const TITLE_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'to',
  'for',
  'of',
  'with',
  'about',
  'over',
  'after',
  'before',
  'from',
  'them',
  'her',
  'him',
  'they',
  'their',
  'ex',
  'my',
  'our',
  'your',
  'missing',
  'memories',
  'memory',
  'heartbreak',
  'breakup',
  'grief',
  'loss',
  'pain',
  'hurt',
  'healing',
  'moving',
  'on',
  'still',
  'just',
  'need',
  'talk',
  'vent',
  'night',
  'nights',
  'today',
  'someone',
  'somebody',
  'everything',
  'nothing',
  'silence',
  'space',
  'time',
  'long',
  'distance',
  'texting',
  'contact',
  'closure',
  'lonely',
  'loneliness',
  'sad',
  'anger',
  'angry',
  'confused',
  'uncertain',
  'stuck',
  'again',
  'back',
  'love',
  'loving',
  'loved',
  'relationship',
  'friend',
  'friends',
  'family',
  'work',
  'school',
  'home',
  'life',
  'feelings',
  'feeling',
  'thinking',
  'cant',
  "can't",
  'move',
  'moving',
])

function getUserPronoun(userTexts) {
  const combined = userTexts.join(' ').toLowerCase()
  if (/\bher\b/.test(combined)) return 'her'
  if (/\bhim\b/.test(combined)) return 'him'
  if (/\bthem\b|\bthey\b|\btheir\b/.test(combined)) return 'them'
  return 'them'
}

function wordKnownToUser(word, userBlob) {
  const normalized = String(word || '').toLowerCase()
  if (!normalized) return true
  if (TITLE_STOP_WORDS.has(normalized)) return true
  return userBlob.includes(normalized)
}

function sanitizeSessionTitle(title, userTexts) {
  const raw = String(title || '').trim()
  if (!raw) return raw

  const userBlob = (userTexts || []).join(' ').toLowerCase()
  const pronoun = getUserPronoun(userTexts)

  let result = raw.replace(
    /\b(of|about|with|for|over|missing)\s+([A-Za-z]{2,24})\b/gi,
    (match, prep, word) => {
      if (wordKnownToUser(word, userBlob)) return match
      return `${prep} ${pronoun}`
    },
  )

  result = result.replace(/\s+/g, ' ').trim()
  return result.slice(0, 80)
}

module.exports = {
  sanitizeSessionTitle,
  getUserPronoun,
  TITLE_STOP_WORDS,
}
