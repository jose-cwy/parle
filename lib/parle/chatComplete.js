const { buildSystemMessages } = require('./prompts')

const IMAGE_CONTEXT_PROMPT = `The user has attached an image. It may be a screenshot of a conversation, a message, or something related to their situation. Read it to understand context but do not describe what you see in the image back to the user unless they ask. Use it silently to inform your response.`

function sentenceClamp(text, maxSentences = 6) {
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
  images,
}) {
  const history = (conversationHistory || []).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.text || m.content || '').slice(0, 1200),
  }))

  const messageCount = history.length + 1

  const systemMessages = buildSystemMessages({
    modeId: modeId || 'cross',
    dontTextStep,
    dontTextMessageCount,
    preferenceProfile,
    contextRecap,
    crossSessionSummary,
    hiddenInjections,
    messageCount,
  })

  const textContent = String(userText || '').slice(0, 1200)
  const imageList = Array.isArray(images) ? images.filter(Boolean).slice(0, 2) : []

  let userMessage
  if (imageList.length) {
    const parts = [
      {
        type: 'text',
        text: imageList.length
          ? `${IMAGE_CONTEXT_PROMPT}\n\n${textContent || '(See attached image)'}`
          : textContent,
      },
      ...imageList.map((url) => ({
        type: 'image_url',
        image_url: { url: String(url).slice(0, 500000) },
      })),
    ]
    userMessage = { role: 'user', content: parts }
  } else {
    userMessage = { role: 'user', content: textContent }
  }

  return [...systemMessages, ...history, userMessage]
}

module.exports = {
  sentenceClamp,
  buildChatCompletionMessages,
  IMAGE_CONTEXT_PROMPT,
}
