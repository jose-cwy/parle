const { openaiChatStream } = require('../openai')

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

async function streamChatReply(
  res,
  { messages, temperature = 0.65, fallbackReply, extraHeaders, doneExtra } = {},
) {
  if (extraHeaders && typeof extraHeaders === 'object') {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (value == null) continue
      res.setHeader(key, String(value))
    }
  }
  initSse(res)

  let reply = ''
  let firstByteAt = 0
  const streamStartedAt = Date.now()
  try {
    for await (const delta of openaiChatStream({ messages, temperature })) {
      if (!firstByteAt) firstByteAt = Date.now()
      reply += delta
      writeSse(res, { delta })
    }
  } catch (error) {
    console.error('chat_stream_error', error)
    if (!reply.trim() && fallbackReply) {
      if (!firstByteAt) firstByteAt = Date.now()
      reply = fallbackReply
      writeSse(res, { delta: reply })
    }
  }

  writeSse(res, {
    done: true,
    reply,
    ttfbMs: firstByteAt ? firstByteAt - streamStartedAt : null,
    ...(doneExtra && typeof doneExtra === 'object' ? doneExtra : {}),
  })
  res.end()
  return reply
}

module.exports = {
  streamChatReply,
}
