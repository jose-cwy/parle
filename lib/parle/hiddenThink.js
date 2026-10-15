const { openaiChatComplete } = require('../openai')

const THINK_PROMPT = `You are a private thinking step for parlé, a heartbreak companion. The user will never see this.

In 4-8 short lines, note:
- sit_with_story vs they_asked_for_take (advice/opinion/analyze)
- wants_analysis or keep_short; lift_length: yes if they asked to analyze — plan that size, do not write long then cut
- what they likely mean under the words
- the feeling that needs to be met first (comfort and understanding before next-steps)
- one NEW observation they did not already say (never paraphrase the whole story)
- if sit_with_story: do not plan any question about coping, dealing, next, relief, distraction, or "what will you do". Stay in the situation. Understand first.
- if early_sit (first 5 user turns) and sit_with_story: plan a statement ending. No question unless thin "what happened" or ask_name
- if they shut down next-steps ("i can't", "i don't know", "i just want to talk"): drop the coping thread completely
- if underspecified ("i miss them") and ask_name is false: reassure, then ask what happened
- if they already gave facts: name the actual tension
- if ask_name=true: the visible last line MUST be the name ask. not optional. not replaced by another question
- if today contradicts any past context, follow today

Do not diagnose health. Do not mention this thinking step. No JSON. Plain notes only.`

function buildThinkBlock(notes) {
  const text = String(notes || '').trim().slice(0, 1200)
  if (!text) return ''
  return `[PRIVATE THINK — not visible to user]
Use these notes to write a more genuine, specific reply. Do not mention thinking, notes, or analysis. Do not sand this down into something bland. Do not retell their story. If lift_length is yes, keep the full breakdown. If sit_with_story, do not interview them about coping or next steps. If ask_name is true, the last line of the user-visible reply MUST be the name question.
${text}`
}

async function runHiddenThink({ userText, history = [], modeId, quality } = {}) {
  const latest = String(userText || '').trim().slice(0, 1200)
  if (!latest) return ''

  const recent = (history || [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'parlé'}: ${String(m.text || m.content || '').slice(0, 400)}`)
    .join('\n')

  const flags = quality
    ? `Flags already known: wants_analysis=${Boolean(quality.wantsAnalysis)} wants_advice=${Boolean(quality.wantsAdvice)} wants_opinion=${Boolean(quality.wantsOpinion)} sit_with_story=${Boolean(quality.sitWithStory)} early_sit=${Boolean(quality.earlySit)} rejected_next_steps=${Boolean(quality.rejectedNextSteps)} lift_length=${Boolean(quality.liftLength)} thin_situation=${Boolean(quality.thinSituation)} ask_name=${Boolean(quality.askName)} name_known=${Boolean(quality.nameKnown)}`
    : ''

  try {
    const notes = await openaiChatComplete({
      messages: [
        { role: 'system', content: THINK_PROMPT },
        {
          role: 'user',
          content: `Active mode: ${modeId || 'cross'}\n${flags}\nRecent:\n${recent || '(start of chat)'}\n\nLatest user message:\n${latest}`,
        },
      ],
      temperature: 0.3,
    })
    return buildThinkBlock(notes)
  } catch {
    return ''
  }
}

module.exports = {
  THINK_PROMPT,
  buildThinkBlock,
  runHiddenThink,
}
