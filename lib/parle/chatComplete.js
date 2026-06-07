const { buildSystemMessages } = require('./prompts')

function sentenceClamp(text, maxSentences = 8) {
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

function buildChatCompletionMessages({
  modeId,
  dontTextStep,
  dontTextMessageCount,
  preferenceProfile,
  contextRecap,
  crossSessionSummary,
  hiddenInjections,
  conversationHistory,
  userText,
}) {
  const systemMessages = buildSystemMessages({
    modeId: modeId || 'listen',
    dontTextStep,
    dontTextMessageCount,
    preferenceProfile,
    contextRecap,
    crossSessionSummary,
    hiddenInjections,
  })

  const history = (conversationHistory || []).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.text || m.content || '').slice(0, 1200),
  }))

  return [
    ...systemMessages,
    ...history,
    { role: 'user', content: String(userText).slice(0, 1200) },
  ]
}

module.exports = {
  sentenceClamp,
  buildChatCompletionMessages,
}
