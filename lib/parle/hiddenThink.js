const { openaiChatComplete } = require('../openai')

const THINK_PROMPT = `You are a private thinking step for parlé, a heartbreak companion. The user will never see this.

In 4-8 short lines, note:
- what they likely mean under the words
- the feeling that needs to be met first
- one specific detail from what they said to use
- what would feel generic vs genuine here
- if today contradicts any past context, follow today

Do not diagnose health. Do not mention this thinking step. No JSON. Plain notes only.`

function buildThinkBlock(notes) {
  const text = String(notes || '').trim().slice(0, 1200)
  if (!text) return ''
  return `[PRIVATE THINK — not visible to user]
Use these notes to write a more genuine, specific reply. Do not mention thinking, notes, or analysis. Do not sand this down into something bland.
${text}`
}

async function runHiddenThink({ userText, history = [], modeId } = {}) {
  const latest = String(userText || '').trim().slice(0, 1200)
  if (!latest) return ''

  const recent = (history || [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'parlé'}: ${String(m.text || m.content || '').slice(0, 400)}`)
    .join('\n')

  try {
    const notes = await openaiChatComplete({
      messages: [
        { role: 'system', content: THINK_PROMPT },
        {
          role: 'user',
          content: `Active mode: ${modeId || 'cross'}\nRecent:\n${recent || '(start of chat)'}\n\nLatest user message:\n${latest}`,
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
