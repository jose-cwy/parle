const DEFAULT_STREAM_TIMEOUT_MS = 60_000
const DEFAULT_COMPLETE_TIMEOUT_MS = 30_000

function isAbortError(error) {
  const name = String(error?.name || '')
  const code = String(error?.code || '')
  return name === 'AbortError' || code === 'ABORT_ERR'
}

function parseTimeoutMs(raw, fallback) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1_000 || n > 120_000) return fallback
  return Math.floor(n)
}

function streamTimeoutMs(env = process.env) {
  return parseTimeoutMs(env.OPENAI_STREAM_TIMEOUT_MS, DEFAULT_STREAM_TIMEOUT_MS)
}

function completeTimeoutMs(env = process.env) {
  return parseTimeoutMs(env.OPENAI_COMPLETE_TIMEOUT_MS, DEFAULT_COMPLETE_TIMEOUT_MS)
}

function combineAbortSignals(signals) {
  const live = (signals || []).filter(Boolean)
  if (!live.length) return undefined
  const controller = new AbortController()
  const onAbort = () => {
    if (!controller.signal.aborted) controller.abort()
  }
  for (const signal of live) {
    if (signal.aborted) {
      onAbort()
      return controller.signal
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

function abortError(message = 'The operation was aborted') {
  const err = new Error(message)
  err.name = 'AbortError'
  err.code = 'ABORT_ERR'
  return err
}

function resolveModel(messages, model) {
  const hasVision = (messages || []).some((m) => Array.isArray(m.content))
  return (
    model ||
    (hasVision ? process.env.OPENAI_VISION_MODEL : process.env.OPENAI_MODEL) ||
    'gpt-4o-mini'
  )
}

async function openaiChatComplete({
  messages,
  model,
  temperature = 0.7,
  returnMeta = false,
  signal,
} = {}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const resolvedModel = resolveModel(messages, model)
  const combined = combineAbortSignals([
    signal,
    AbortSignal.timeout(completeTimeoutMs()),
  ])

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
    signal: combined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`OpenAI error ${res.status}: ${text.slice(0, 300)}`)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  const content = String(data?.choices?.[0]?.message?.content || '').trim()
  if (returnMeta) {
    return {
      content,
      usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: resolvedModel,
    }
  }
  return content
}

async function* openaiChatStream({ messages, model, temperature = 0.7, signal } = {}) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }

  const resolvedModel = resolveModel(messages, model)
  const combined = combineAbortSignals([
    signal,
    AbortSignal.timeout(streamTimeoutMs()),
  ])

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
    signal: combined,
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

  try {
    while (true) {
      if (combined?.aborted) {
        throw abortError()
      }

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
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* ignore */
    }
  }
}

module.exports = {
  openaiChatComplete,
  openaiChatStream,
  isAbortError,
  combineAbortSignals,
  streamTimeoutMs,
  completeTimeoutMs,
  DEFAULT_STREAM_TIMEOUT_MS,
  DEFAULT_COMPLETE_TIMEOUT_MS,
}
