const BANNED_OPENERS = [
  /that sounds (really )?(frustrating|hurtful|tough)/i,
  /it'?s understandable to feel/i,
  /that mix of warmth and sadness/i,
  /it'?s normal to feel/i,
  /that must have been/i,
  /i'?m sorry you(?:'re| are) going through/i,
]

const COPE_QUESTIONS = [
  /how do you cope/i,
  /have you found any small moments of relief/i,
  /what are you going to do/i,
  /what(?:'s| is) one small thing you can do/i,
  /how will you deal/i,
  /have you tried/i,
]

const MINDREAD = [
  /they never (actually )?loved you/i,
  /they (don'?t|didn'?t) (even )?care about you/i,
  /they wanted to hurt you/i,
  /they were using you/i,
  /they already replaced you/i,
  /they'?re (probably )?happier without you/i,
  /they (do not|don't) prioritize you/i,
  /she (might have|must have) felt overwhelmed/i,
  /if she felt overwhelmed/i,
  /often signals (a need|that)/i,
  /\b(?:she's|she is|they(?:'re| are)) already done\b/i,
  /contemplating ending/i,
  /moving on in (her|their|his) own way/i,
]

const ADVICE = [
  /\byou should\b/i,
  /\byou need to\b/i,
  /\btry to\b/i,
  /\bhave you tried\b/i,
  /\bmy advice\b/i,
  /\bnext steps?\b/i,
]

const THERAPY = [
  /how does that (make you feel|resonate)/i,
  /what do you think this says about/i,
  /it sounds like you(?:'re| are) experiencing/i,
  /that'?s such a (poignant|compelling|interesting) (thought|perspective)/i,
]

const SEND_PUSH = [/\bjust send it\b/i, /\bgo ahead and (text|call)/i, /\byou should text them\b/i]

function countQuestions(text) {
  return (String(text || '').match(/\?/g) || []).length
}

function firstLine(text) {
  return String(text || '')
    .split(/\n/)
    .map((l) => l.trim())
    .find(Boolean) || ''
}

function overlapRatio(userText, reply) {
  const userTokens = new Set(
    String(userText || '')
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((t) => t.length > 3),
  )
  const replyTokens = String(reply || '')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((t) => t.length > 3)
  if (!userTokens.size || !replyTokens.length) return 0
  const hits = replyTokens.filter((t) => userTokens.has(t)).length
  return hits / replyTokens.length
}

function scoreReply(scenario, reply) {
  const text = String(reply || '').trim()
  const expect = scenario.expect || {}
  const deductions = []
  let score = 10

  if (!text || text.length < 8) {
    return { score: 0, deductions: ['empty'], questions: 0 }
  }

  for (const re of BANNED_OPENERS) {
    if (re.test(firstLine(text))) {
      score -= 1.5
      deductions.push('banned_opener')
      break
    }
  }

  const questions = countQuestions(text)
  if (expect.noQuestions && questions > 0) {
    score -= 2.5
    deductions.push('vent_or_no_question_failed')
  }
  if (expect.noForcedQuestion && questions > 0) {
    score -= 1.5
    deductions.push('forced_question_on_close')
  }
  if (expect.noCopeQuestion) {
    for (const re of COPE_QUESTIONS) {
      if (re.test(text)) {
        score -= 2
        deductions.push('cope_question')
        break
      }
    }
  }
  if (expect.noUnsolicitedAdvice && !expect.mayAdvise) {
    for (const re of ADVICE) {
      if (re.test(text)) {
        score -= 1.5
        deductions.push('unsolicited_advice')
        break
      }
    }
  }
  if (expect.noMindRead) {
    for (const re of MINDREAD) {
      if (re.test(text)) {
        score -= 2
        deductions.push('unsupported_mindread')
        break
      }
    }
  }
  if (expect.noTherapy) {
    for (const re of THERAPY) {
      if (re.test(text)) {
        score -= 1.5
        deductions.push('therapy_talk')
        break
      }
    }
  }
  if (expect.noUnsolicitedSend) {
    for (const re of SEND_PUSH) {
      if (re.test(text)) {
        score -= 3
        deductions.push('encouraged_contact')
        break
      }
    }
  }
  if (expect.noInventPlot && /they (cheated|left you|dumped you|never loved)/i.test(text)) {
    score -= 2
    deductions.push('invented_plot')
  }
  if (expect.noForceStory && /tell me what happened/i.test(text) && /don'?t want to talk about what happened/i.test(scenario.userText)) {
    score -= 2
    deductions.push('forced_story')
  }

  const ov = overlapRatio(scenario.userText, text)
  if (ov > 0.55) {
    score -= 1
    deductions.push('parrot')
  }

  if (expect.comfortFirst && scenario.modeId === 'logical') {
    /* logical may lead with a distinction */
  } else if (expect.comfortFirst) {
    const lead = firstLine(text).toLowerCase()
    if (/^(so |look[,.]? |here'?s the truth|the rational)/.test(lead)) {
      score -= 0.5
      deductions.push('cold_open')
    }
  }

  if (questions > 2 && scenario.modeId !== 'talk') {
    score -= 1
    deductions.push('question_stack')
  }

  return {
    score: Math.max(0, Math.round(score * 10) / 10),
    deductions,
    questions,
    overlap: Math.round(ov * 100) / 100,
  }
}

function summarize(rows) {
  const n = rows.length || 1
  const avg = rows.reduce((s, r) => s + (r.heuristic?.score || 0), 0) / n
  const think = rows.filter((r) => r.thinkMs != null)
  const avgThink = think.length ? think.reduce((s, r) => s + r.thinkMs, 0) / think.length : 0
  const avgReply = rows.reduce((s, r) => s + (r.replyMs || 0), 0) / n
  const tokensIn = rows.reduce((s, r) => s + (r.usage?.prompt_tokens || 0), 0)
  const tokensOut = rows.reduce((s, r) => s + (r.usage?.completion_tokens || 0), 0)
  const byMode = {}
  for (const row of rows) {
    const mode = row.modeId
    byMode[mode] = byMode[mode] || { n: 0, score: 0 }
    byMode[mode].n += 1
    byMode[mode].score += row.heuristic?.score || 0
  }
  for (const mode of Object.keys(byMode)) {
    byMode[mode].avg = Math.round((byMode[mode].score / byMode[mode].n) * 100) / 100
    delete byMode[mode].score
  }
  const miniIn = 0.15 / 1e6
  const miniOut = 0.6 / 1e6
  return {
    n: rows.length,
    avgScore: Math.round(avg * 100) / 100,
    avgThinkMs: Math.round(avgThink),
    avgReplyMs: Math.round(avgReply),
    avgTotalMs: Math.round(avgThink + avgReply),
    promptTokens: tokensIn,
    completionTokens: tokensOut,
    estUsdGpt4oMini: Math.round((tokensIn * miniIn + tokensOut * miniOut) * 10000) / 10000,
    byMode,
  }
}

module.exports = { scoreReply, summarize }
