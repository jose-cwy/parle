async function openaiChatComplete({ messages, model, temperature = 0.7 }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const hasVision = messages.some((m) => Array.isArray(m.content))
  const resolvedModel =
    model ||
    (hasVision ? process.env.OPENAI_VISION_MODEL : process.env.OPENAI_MODEL) ||
    'gpt-4o-mini'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolvedModel,
      temperature,
      messages,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`OpenAI error ${res.status}: ${text.slice(0, 300)}`)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  return String(content || '').trim()
}

async function* openaiChatStream({ messages, model, temperature = 0.7 }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const hasVision = messages.some((m) => Array.isArray(m.content))
  const resolvedModel =
    model ||
    (hasVision ? process.env.OPENAI_VISION_MODEL : process.env.OPENAI_MODEL) ||
    'gpt-4o-mini'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: resolvedModel,
      temperature,
      messages,
      stream: true,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`OpenAI error ${res.status}: ${text.slice(0, 300)}`)
    err.status = res.status
    throw err
  }

  if (!res.body) {
    throw new Error('OpenAI stream body missing')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data)
        const delta = parsed?.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        /* ignore malformed stream chunks */
      }
    }
  }
}

module.exports = {
  openaiChatComplete,
  openaiChatStream,
}

