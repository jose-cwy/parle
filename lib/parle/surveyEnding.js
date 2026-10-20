const SURVEY_END_RE =
  /\b(anyway\s+)?that'?s all( i needed( to say)?)?\b|\bi think i'?m good( for now)?\b|\bi'?m good for now\b|\bi'?ll try to sleep\b|\bi will try to sleep\b|\bi'?m gonna (sleep|go)\b|\bthat'?s enough for (now|today)\b|\bi'?m done talking( for now)?\b/i

const STILL_VENTING_RE =
  /\b(don'?t fix( it)?|just listen|don'?t (advise|advice)|keep going|i'?m still|still (so )?(mad|angry|hurt|sad|fuming)|i hate|let me (vent|finish)|not done)\b/i

function isSurveyConversationEnding(text) {
  const raw = String(text || '').replace(/[\u2018\u2019]/g, "'").trim()
  if (!raw || raw.length > 280) return false
  if (STILL_VENTING_RE.test(raw)) return false
  if (/\?/.test(raw)) return false
  return SURVEY_END_RE.test(raw)
}

module.exports = {
  isSurveyConversationEnding,
  SURVEY_END_RE,
  STILL_VENTING_RE,
}
module.exports.default = module.exports
