const { openaiChatStream } = require('../openai')
const { sentenceClamp } = require('./chatComplete')

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
  { messages, temperature = 0.65, maxSentences = 6, fallbackReply } = {},
) {
  initSse(res)

  let reply = ''
  try {
    for await (const delta of openaiChatStream({ messages, temperature })) {
      reply += delta
      writeSse(res, { delta })
    }
  } catch (error) {
    console.error('chat_stream_error', error)
    if (!reply.trim() && fallbackReply) {
      reply = fallbackReply
      writeSse(res, { delta: reply })
    }
  }

  reply = sentenceClamp(reply, maxSentences)
  writeSse(res, { done: true, reply })
  res.end()
  return reply
}

module.exports = {
  streamChatReply,
}
