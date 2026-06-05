async function openaiChatComplete({ messages, model, temperature = 0.7 }) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

module.exports = {
  openaiChatComplete,
}

