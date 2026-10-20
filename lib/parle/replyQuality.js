const ANALYSIS_RE =
  /\b(analy[sz]e|break(?: this| it)? down|go deep|be (brutally )?honest|tell me (what(?:'s| is) (really )?going on|what you think)|what do you (think|make) of|explain (this|what(?:'s| is) happening|my situation)|give me (a |your )?(read|take|breakdown)|walk me through)\b/i

const ADVICE_RE =
  /\b(what should i do|advise me|give me advice|tell me what to do|what to do after|what would you do|how do i (deal|handle|fix|cope)|how (am i|do i) (supposed to|going to) (deal|handle)|what now|what'?s next|next steps)\b/i

const OPINION_RE = /\bwhat do you think\b/i

const PERSON_PRONOUN_RE =
  /\b(she|he|her|him|they|them|their|my ex|the ex|girlfriend|boyfriend|partner)\b/i

const NAME_DECLINE_RE =
  /\b(rather not|prefer not|don'?t (want to|wanna) (say|share|give)|no name|just (call )?(her|him|them)|keep (it|her|him|them) anonymous)\b/i

const ASKED_NAME_RE =
  /\bwhat(?:'s| is) (her|his|their) name\b|\bif you(?:'re| are) (ok|okay|comfortable) saying\b/i

const NAME_GIVEN_RE =
  /\b(?:(?:her|his|their) name(?:'?s| is| was)?\s+|called\s+|named\s+)([A-Za-z][A-Za-z'-]{1,30}(?:\s+[A-Za-z][A-Za-z'-]{1,30})?)\b/i

const ROLE_LABELS = new Set([
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
  'girlfriend',
  'boyfriend',
  'partner',
  'wife',
  'husband',
  'crush',
  'situationship',
])

const SIT_MODES = new Set(['cross', 'emotional'])

const CLOSE_TURN_RE =
  /\b(that'?s all|i'?m good for now|i will try to sleep|i'?ll try to sleep|i said it|don'?t fix it|i think i'?m good)\b/i

const EVENT_STORY_RE =
  /\b(fight|fought|club(?:bing)?|texted|broke up|breakup|break up|cheated|posted|story|needed space|silence|ghosted|dumped|left me|pull(?:ed|ing) away|unmatched|blocked)\b/i

const SKIP_STORY_RE =
  /\b(don'?t want to (get into( it)?|talk about( what happened| it| the story)?|share)|i don'?t want to (get into it|talk about what happened)|without (going into|sharing) (it|the story|details)|skip (the )?(story|details))\b/i

const DISTRESSED_RE =
  /\b(spiral(?:ling|ing)?|panic(?:king|ked)?|can'?t (stop crying|breathe)|i'?m a mess|sobbing|having a breakdown|freaking out)\b/i

function rejectedNextSteps(userText) {
  const t = String(userText || '').trim()
  if (!t) return false
  if (/^i\s+can[;'’]?t\.?$/i.test(t)) return true
  if (/^(idk|i\s+don'?t\s+know)\.?$/i.test(t)) return true
  if (/\bi\s+just\s+want\s+to\s+talk\b/i.test(t)) return true
  if (/\bnot\s+trying\s+to\s+cope\b/i.test(t)) return true
  if (/\bdon'?t\s+(want|ask)\s+(me\s+)?(what\s+to\s+do|how\s+to\s+cope)\b/i.test(t)) return true
  return false
}

function wantsAnalysis(text) {
  return ANALYSIS_RE.test(String(text || ''))
}

function wantsAdvice(text) {
  return ADVICE_RE.test(String(text || ''))
}

function wantsOpinion(text) {
  const value = String(text || '')
  return OPINION_RE.test(value) || wantsAnalysis(value)
}

function isThinSituation(text) {
  const t = String(text || '').trim()
  if (!t) return false
  if (t.length > 160) return false
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length > 22) return false
  if (/\b(fight|club|texted|broke up|breakup|cheated|posted|story)\b/i.test(t)) return false
  return /\b(i miss (them|her|him|you)|miss (them|her|him)|i'?m (sad|hurt|lost|empty|miserable)|it hurts|i feel (bad|sad|lost|empty|sick|miserable))\b/i.test(
    t,
  )
}

function refersToPerson(text) {
  return PERSON_PRONOUN_RE.test(String(text || ''))
}

function looksLikeRealName(value) {
  const tokens = String(value || '')
    .toLowerCase()
    .split(/[^a-z'-]+/)
    .filter(Boolean)
  if (!tokens.length) return false
  return tokens.some((token) => token.length >= 2 && !ROLE_LABELS.has(token))
}

function extractGivenName(text) {
  const match = String(text || '').match(NAME_GIVEN_RE)
  if (!match) return null
  const name = String(match[1] || '').trim()
  if (!looksLikeRealName(name)) return null
  return name
}

function namesFromLivingProfile(livingProfile) {
  const names = []
  for (const fact of livingProfile?.facts || []) {
    if (fact.category !== 'situation') continue
    const key = String(fact.key || '')
    if (!key.startsWith('person:')) continue
    const value = key.slice('person:'.length).trim()
    if (looksLikeRealName(value)) names.push(value)
  }
  return names
}

function collectUserTexts(history, userText) {
  const prior = (history || [])
    .filter((m) => m.role === 'user')
    .map((m) => String(m.text || m.content || ''))
  return [...prior, String(userText || '')]
}

function countPersonMentionTurns(history, userText) {
  return collectUserTexts(history, userText).filter((text) => refersToPerson(text)).length
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
  if (modeId === 'vent') return false
  const combined = collectUserTexts(history, userText).join(' ')
  if (!refersToPerson(userText) && !(talkMode && refersToPerson(combined))) return false
  if (talkMode && !refersToPerson(combined)) return false
  if (hasKnownPersonName({ history, userText, livingProfile })) return false
  if (userDeclinedName(history, userText)) return false
  if (assistantAlreadyAskedName(history)) return false
  const mentions = countPersonMentionTurns(history, userText)
  if (mentions < 3 || mentions > 5) return false
  return true
}

function userTurnCount(history, userText) {
  return collectUserTexts(history, userText).filter((text) => String(text || '').trim()).length
}

function hasEventStory(text) {
  return EVENT_STORY_RE.test(String(text || ''))
}

function eventBearingTurns(history, userText) {
  return collectUserTexts(history, userText).filter((text) => hasEventStory(text)).length
}

function declinedStory(text) {
  return SKIP_STORY_RE.test(String(text || ''))
}

function isDistressed(text) {
  return DISTRESSED_RE.test(String(text || ''))
}

function closedTheTurn(text) {
  return CLOSE_TURN_RE.test(String(text || ''))
}

function resolveStoryPhase({
  advice,
  opinion,
  skipStory,
  storyHeld,
  hasEvents,
  rejectedPlan,
  closed,
  modeId,
} = {}) {
  if (modeId === 'vent') return 'vent'
  if (closed) return 'close'
  if ((advice || opinion) && (skipStory || !hasEvents)) return 'plan_without_story'
  if (advice || opinion) return 'advise'
  if (rejectedPlan) return 'gather'
  if (storyHeld) return 'held'
  return 'gather'
}

function getReplyQualitySignals({
  userText,
  history = [],
  livingProfile = null,
  modeId = 'cross',
} = {}) {
  const analysis = wantsAnalysis(userText)
  const advice = wantsAdvice(userText)
  const opinion = wantsOpinion(userText)
  const askName = shouldAskPersonName({ userText, history, livingProfile, modeId })
  const thin = isThinSituation(userText) && !askName
  const sitMode = SIT_MODES.has(modeId || 'cross')
  const turns = userTurnCount(history, userText)
  const eventTurns = eventBearingTurns(history, userText)
  const hasEvents = eventTurns > 0
  const storyHeld = eventTurns >= 2
  const skipStory = declinedStory(userText)
  const distressed = isDistressed(userText)
  const rejectedPlan = rejectedNextSteps(userText)
  const closed = closedTheTurn(userText)
  const storyPhase = resolveStoryPhase({
    advice,
    opinion,
    skipStory,
    storyHeld,
    hasEvents,
    rejectedPlan,
    closed,
    modeId: modeId || 'cross',
  })
  const sitWithStory = sitMode && (storyPhase === 'gather' || storyPhase === 'held')
  const planWithoutStory = storyPhase === 'plan_without_story'
  const earlySit = storyPhase === 'gather'

  return {
    wantsAnalysis: analysis,
    wantsAdvice: advice,
    wantsOpinion: opinion,
    liftLength: analysis || opinion,
    thinSituation: thin,
    askName,
    nameKnown: hasKnownPersonName({ history, userText, livingProfile }),
    sitWithStory,
    userTurnCount: turns,
    eventTurns,
    storyHeld,
    storyPhase,
    earlySit,
    planWithoutStory,
    distressed,
    rejectedNextSteps: sitWithStory && rejectedPlan,
    closedTurn: closed || storyPhase === 'close',
    modeId: modeId || 'cross',
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

  if (signals.modeId === 'logical') {
    lines.push(
      'THIS TURN — MUST: do not invent the other person\'s intentions, feelings, or inner life. If the user did not state a motive, say you do not know rather than claiming they never loved, did not care, wanted to hurt, felt overwhelmed, or were already done. At most one question. Prefer none when analyzing. Do not quiz them (no stacked "did they / were they / what were the moments").',
    )
  }

  if (signals.wantsAnalysis && signals.modeId !== 'logical') {
    lines.push(
      'THIS TURN — MUST: analysis stays with facts they stated. Structure: (1) what happened, (2) optional possibilities labeled as possibilities, (3) what you do not know. Do not invent that the other person felt overwhelmed, was already done, or is moving on unless they said that. Do not write "often signals" or "indicates she needed to process" as if you know their motive. "Asked for space" is an action, not a proven feeling.',
    )
  }

  if (signals.modeId === 'vent' || signals.storyPhase === 'vent') {
    lines.push(
      'THIS TURN — MUST: Vent mode. Zero questions. Zero question marks, including rhetorical ones ("cheer them on?"). Zero advice. Zero "what happened". Acknowledge and match energy. Add one short reaction; do not paste their whole last sentence back. Ignore gather-the-story instructions.',
    )
  } else if (signals.storyPhase === 'close' || signals.closedTurn) {
    lines.push(
      'THIS TURN — MUST: they closed the turn. Do not ask a question. A short acknowledgment is enough. No plan, no interview.',
    )
  } else if (signals.storyPhase === 'plan_without_story') {
    lines.push(
      'THIS TURN — MUST: they want next steps and do not want to share the story. Help with what to do. Do not force what happened. Do not guilt them into sharing. Keep advice concrete.',
    )
  } else if (signals.storyPhase === 'advise') {
    lines.push(
      'THIS TURN: they asked what you think or what to do. You may take a position or give advice. Stay specific to their facts.',
    )
  } else if (signals.storyPhase === 'held') {
    lines.push(
      'THIS TURN — MUST: you have enough of the situation. You may ask how they are doing or how they are holding it, tied to their actual facts. If they mentioned feeling miserable or similar earlier, callback: e.g. "you said earlier you were miserable. with [specific situation], how are you holding that?" Unsolicited plans still wait unless they asked what to do.',
    )
  } else if (signals.sitWithStory || signals.storyPhase === 'gather') {
    lines.push(
      'THIS TURN — MUST: comfort/understanding in the first line. Then at most one situation question if they are still talking (then what, what they said, how they found out). MUST NOT interview. MUST NOT ask how they cope, how they will deal, what they will do next, relief, distraction, or "one small thing you can do". Banned: "how do you cope with that sense of loss?", "have you found any small moments of relief or distraction". MUST NOT recap unnamed feelings ("that mix of warmth and sadness").',
    )
    if (signals.distressed) {
      lines.push(
        'THIS TURN: they seem very distressed. One real feeling check is allowed, then still ask about the situation. Do not turn it into a coping-plan interview.',
      )
    }
    if (signals.rejectedNextSteps) {
      lines.push(
        'THIS TURN — MUST: they shut down a next-step / coping question (e.g. "i can\'t", "i don\'t know", "i just want to talk"). Drop that thread. Ask about the situation instead, not relief or what they will do.',
      )
    }
  }

  if (signals.thinSituation && signals.storyPhase === 'gather') {
    lines.push(
      'THIS TURN: the situation is unclear. Reassure in one line, then ask what happened. Do not invent a breakup, a fight, or that the other person does not care.',
    )
  }

  if (signals.askName) {
    lines.push(
      'THIS TURN — MUST: they talked about someone with no real name. End the reply with exactly one question, the name ask, e.g. "what\'s her name, if you\'re ok saying?" Do not replace it with what happened, how they feel, or next-steps. This is not optional.',
    )
  } else if (signals.nameKnown) {
    lines.push('A name is already known. Use it. Do not ask for it again.')
  }

  return lines.join('\n')
}

module.exports = {
  wantsAnalysis,
  wantsAdvice,
  wantsOpinion,
  isThinSituation,
  refersToPerson,
  looksLikeRealName,
  extractGivenName,
  hasKnownPersonName,
  countPersonMentionTurns,
  shouldAskPersonName,
  userTurnCount,
  rejectedNextSteps,
  hasEventStory,
  eventBearingTurns,
  declinedStory,
  isDistressed,
  closedTheTurn,
  resolveStoryPhase,
  getReplyQualitySignals,
  buildReplyQualityBlock,
}
