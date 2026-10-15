const { openaiChatComplete } = require('../openai')

const THINK_PROMPT = `You are a private thinking step for parlé, a heartbreak companion. The user will never see this.

In 4-8 short lines, note:
- wants_analysis or keep_short (did they ask to analyze / break it down / go deep?)
- lift_length: yes if wants_analysis — the visible reply must be planned at that size, not written long then cut
- what they likely mean under the words
- the feeling that needs to be met first
- one NEW observation they did not already say (never paraphrase the whole story)
- if the situation is underspecified (e.g. "i miss them"): reassure, then ask what happened — do not assume a plot
- if they already gave facts: name the actual tension (broken promise, silence, space vs going out, etc.)
- name known? if not, early in the chat, and they used she/he/they: one optional light ask. if they declined, skip
- if today contradicts any past context, follow today

Do not diagnose health. Do not mention this thinking step. No JSON. Plain notes only.`

function buildThinkBlock(notes) {
  const text = String(notes || '').trim().slice(0, 1200)
  if (!text) return ''
  return `[PRIVATE THINK — not visible to user]
Use these notes to write a more genuine, specific reply. Do not mention thinking, notes, or analysis. Do not sand this down into something bland. Do not retell their story. If lift_length is yes, keep the full breakdown.
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
    ? `Flags already known: wants_analysis=${Boolean(quality.wantsAnalysis)} lift_length=${Boolean(quality.liftLength)} thin_situation=${Boolean(quality.thinSituation)} ask_name=${Boolean(quality.askName)} name_known=${Boolean(quality.nameKnown)}`
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
