const ANALYSIS_RE =
  /\b(analy[sz]e|break(?: this| it)? down|go deep|be (brutally )?honest|tell me (what(?:'s| is) (really )?going on|what you think)|what do you (think|make) of|explain (this|what(?:'s| is) happening|my situation)|give me (a |your )?(read|take|breakdown)|walk me through)\b/i

const PERSON_PRONOUN_RE =
  /\b(she|he|her|him|they|them|their|my ex|the ex|girlfriend|boyfriend|partner)\b/i

const NAME_DECLINE_RE =
  /\b(rather not|prefer not|don'?t (want to|wanna) (say|share|give)|no name|just (call )?(her|him|them)|keep (it|her|him|them) anonymous)\b/i

const ASKED_NAME_RE =
  /\bwhat(?:'s| is) (her|his|their) name\b|\bif you(?:'re| are) (ok|okay|comfortable) saying\b/i

const NAME_GIVEN_RE =
  /\b(?:(?:her|his|their) name(?:'?s| is| was)?\s+|called\s+|named\s+)([A-Za-z][A-Za-z'-]{1,30})\b/i

const STOP_NAMES = new Set([
  'she',
  'he',
  'her',
  'him',
  'they',
  'them',
  'their',
  'ex',
  'my',
  'the',
  'someone',
  'somebody',
  'person',
  'girl',
  'guy',
  'friend',
])

function wantsAnalysis(text) {
  return ANALYSIS_RE.test(String(text || ''))
}

function isThinSituation(text) {
  const t = String(text || '').trim()
  if (!t) return false
  if (t.length > 160) return false
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length > 22) return false
  if (/\b(fight|club|texted|broke up|breakup|cheated|posted|story)\b/i.test(t)) return false
  return /\b(i miss (them|her|him|you)|miss (them|her|him)|i'?m (sad|hurt|lost|empty)|it hurts|i feel (bad|sad|lost|empty|sick))\b/i.test(
    t,
  )
}

function refersToPerson(text) {
  return PERSON_PRONOUN_RE.test(String(text || ''))
}

function extractGivenName(text) {
  const match = String(text || '').match(NAME_GIVEN_RE)
  if (!match) return null
  const name = String(match[1] || '').trim()
  if (!name || STOP_NAMES.has(name.toLowerCase())) return null
  return name
}

function namesFromLivingProfile(livingProfile) {
  const names = []
  for (const fact of livingProfile?.facts || []) {
    if (fact.category !== 'situation') continue
    const key = String(fact.key || '')
    if (key.startsWith('person:')) {
      const value = key.slice('person:'.length).trim()
      if (value && !STOP_NAMES.has(value) && !/\bex\b/i.test(value)) names.push(value)
    }
  }
  return names
}

function collectUserTexts(history, userText) {
  const prior = (history || [])
    .filter((m) => m.role === 'user')
    .map((m) => String(m.text || m.content || ''))
  return [...prior, String(userText || '')]
}

function countUserMessages(history, userText) {
  return collectUserTexts(history, userText).filter((t) => t.trim()).length
}

function hasKnownPersonName({ history = [], userText = '', livingProfile = null } = {}) {
  if (namesFromLivingProfile(livingProfile).length) return true
  return collectUserTexts(history, userText).some((text) => Boolean(extractGivenName(text)))
}

function userDeclinedName(history, userText) {
  return collectUserTexts(history, userText).some((text) => NAME_DECLINE_RE.test(text))
}

function assistantAlreadyAskedName(history) {
  return (history || []).some(
    (m) =>
      m.role !== 'user' && ASKED_NAME_RE.test(String(m.text || m.content || '')),
  )
}

function shouldAskPersonName({
  userText,
  history = [],
  livingProfile = null,
  modeId = 'cross',
} = {}) {
  const talkMode = modeId === 'talk'
  const combined = collectUserTexts(history, userText).join(' ')
  if (!refersToPerson(userText) && !(talkMode && refersToPerson(combined))) return false
  if (talkMode && !refersToPerson(combined)) return false
  if (hasKnownPersonName({ history, userText, livingProfile })) return false
  if (userDeclinedName(history, userText)) return false
  if (assistantAlreadyAskedName(history)) return false
  if (countUserMessages(history, userText) > 4) return false
  return true
}

function getReplyQualitySignals({
  userText,
  history = [],
  livingProfile = null,
  modeId = 'cross',
} = {}) {
  const analysis = wantsAnalysis(userText)
  const thin = isThinSituation(userText)
  const askName = shouldAskPersonName({ userText, history, livingProfile, modeId })
  return {
    wantsAnalysis: analysis,
    liftLength: analysis,
    thinSituation: thin,
    askName,
    nameKnown: hasKnownPersonName({ history, userText, livingProfile }),
  }
}

function buildReplyQualityBlock(signals = {}) {
  const lines = [
    '[PRIVATE REPLY QUALITY — not visible to user]',
    'Do not retell the story they just told. React with one new observation, then (if they already gave facts) say what it means.',
    'Never open with "that sounds frustrating/hurtful" or "it\'s understandable to feel". Those are empty recaps.',
    'Default style stays short and specific. Banned filler ("it\'s hard", "it\'s normal to feel", "that must have been", empty "that\'s [adjective] perspective") is the default — not a reason to delete a finished reply.',
  ]

  if (signals.liftLength) {
    lines.push(
      'THIS TURN: they asked for analysis or a real breakdown. Lift short-reply caps and write as long as the situation needs. Keep scannable (short lines, blank lines). Do not shrink a long answer after writing it. Mid-sentence "that\'s" is fine when it is the honest line.',
    )
  } else {
    lines.push('THIS TURN: keep the default short length unless they clearly asked for a breakdown.')
  }

  if (signals.thinSituation) {
    lines.push(
      'THIS TURN: the situation is unclear. Reassure in one line, then ask what happened. Do not invent a breakup, a fight, or that the other person does not care.',
    )
  }

  if (signals.askName) {
    lines.push(
      'THIS TURN: they are talking about someone without a name. After your real reaction, ask once, lightly, e.g. "what\'s her name, if you\'re ok saying?" If they skip it, drop it.',
    )
  } else if (signals.nameKnown) {
    lines.push('A name is already known. Use it. Do not ask for it again.')
  }

  return lines.join('\n')
}

module.exports = {
  wantsAnalysis,
  isThinSituation,
  refersToPerson,
  extractGivenName,
  hasKnownPersonName,
  shouldAskPersonName,
  getReplyQualitySignals,
  buildReplyQualityBlock,
}
