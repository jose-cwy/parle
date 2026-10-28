const { openaiChatStream, isAbortError } = require('../openai')

function initSse(res) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function shouldPersistStreamedReply(result) {
  if (!result || result.aborted) return false
  return Boolean(String(result.reply || '').trim())
}

function attachClientAbort(req, res) {
  const controller = new AbortController()
  const abort = () => {
    if (!controller.signal.aborted) controller.abort()
  }

  // After Next parses the JSON body the IncomingMessage is complete/ended.
  // Serverless platforms also emit `res.close` when headers flush, not only
  // when the user cancels. Treating those as abort cancelled OpenAI before
  // any tokens and skipped assistant persistence (user rows remained).
  // Real client cancel still aborts via `req.aborted`; a dead response
  // socket is detected when SSE writes throw.
  if (req?.aborted) abort()
  req?.once?.('aborted', abort)

  return {
    signal: controller.signal,
    dispose() {
      req?.off?.('aborted', abort)
    },
  }
}

async function streamChatReply(
  res,
  {
    messages,
    temperature = 0.65,
    fallbackReply,
    extraHeaders,
    doneExtra,
    signal,
    streamFn = openaiChatStream,
  } = {},
) {
  if (extraHeaders && typeof extraHeaders === 'object') {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (value == null) continue
      res.setHeader(key, String(value))
    }
  }
  initSse(res)

  let reply = ''
  let aborted = Boolean(signal?.aborted)
  let firstByteAt = 0
  const streamStartedAt = Date.now()

  try {
    for await (const delta of streamFn({ messages, temperature, signal })) {
      if (signal?.aborted) {
        aborted = true
        break
      }
      if (!firstByteAt) firstByteAt = Date.now()
      reply += delta
      try {
        writeSse(res, { delta })
      } catch {
        aborted = true
        break
      }
    }
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      aborted = true
    } else {
      console.error('chat_stream_error', error)
      if (!aborted && !reply.trim() && fallbackReply) {
        if (!firstByteAt) firstByteAt = Date.now()
        reply = fallbackReply
        try {
          writeSse(res, { delta: reply })
        } catch {
          aborted = true
        }
      }
    }
  }

  if (aborted) {
    try {
      if (typeof res.end === 'function' && !res.writableEnded) res.end()
    } catch {
      /* ignore */
    }
    return { reply: '', aborted: true }
  }

  try {
    writeSse(res, {
      done: true,
      reply,
      ttfbMs: firstByteAt ? firstByteAt - streamStartedAt : null,
      ...(doneExtra && typeof doneExtra === 'object' ? doneExtra : {}),
    })
  } catch {
    return { reply: '', aborted: true }
  }

  try {
    res.end()
  } catch {
    /* ignore */
  }
  return { reply, aborted: false }
}

module.exports = {
  streamChatReply,
  shouldPersistStreamedReply,
  attachClientAbort,
}
