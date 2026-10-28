const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  openaiChatStream,
  openaiChatComplete,
  isAbortError,
  streamTimeoutMs,
  completeTimeoutMs,
  DEFAULT_STREAM_TIMEOUT_MS,
  DEFAULT_COMPLETE_TIMEOUT_MS,
} = require('../../lib/openai')
const {
  streamChatReply,
  shouldPersistStreamedReply,
  attachClientAbort,
} = require('../../lib/parle/chatStreamResponse')
const { withProcessingLock, isProcessing } = require('../../lib/chatProcessingLock')

function fakeRes() {
  const chunks = []
  const listeners = {}
  return {
    statusCode: 0,
    headers: {},
    writableEnded: false,
    chunks,
    listeners,
    setHeader(key, value) {
      this.headers[key] = value
    },
    flushHeaders() {},
    write(chunk) {
      chunks.push(String(chunk))
    },
    end() {
      this.writableEnded = true
    },
    once(event, fn) {
      listeners[event] = listeners[event] || []
      listeners[event].push(fn)
    },
    off(event, fn) {
      listeners[event] = (listeners[event] || []).filter((item) => item !== fn)
    },
    emit(event) {
      for (const fn of listeners[event] || []) fn()
    },
  }
}

function fakeReq() {
  const listeners = {}
  return {
    aborted: false,
    destroyed: false,
    listeners,
    once(event, fn) {
      listeners[event] = listeners[event] || []
      listeners[event].push(fn)
    },
    off(event, fn) {
      listeners[event] = (listeners[event] || []).filter((item) => item !== fn)
    },
    emit(event) {
      for (const fn of listeners[event] || []) fn()
    },
  }
}

function abortErr() {
  const err = new Error('aborted')
  err.name = 'AbortError'
  return err
}

test('completed stream persists exactly one assistant reply', async () => {
  const res = fakeRes()
  async function* ok() {
    yield 'hello '
    yield 'there'
  }
  const result = await streamChatReply(res, { messages: [], streamFn: ok })
  assert.equal(result.aborted, false)
  assert.equal(result.reply, 'hello there')
  assert.equal(shouldPersistStreamedReply(result), true)
  assert.equal((res.chunks.join('').match(/"done":true/g) || []).length, 1)
})

test('slow but progressing stream is not treated as failure', async () => {
  const res = fakeRes()
  async function* slow() {
    yield 'one '
    await new Promise((resolve) => setTimeout(resolve, 80))
    yield 'two'
  }
  const result = await streamChatReply(res, {
    messages: [],
    streamFn: slow,
    fallbackReply: 'FALLBACK',
  })
  assert.equal(result.aborted, false)
  assert.equal(result.reply, 'one two')
  assert.equal(shouldPersistStreamedReply(result), true)
})

test('aborted stream does not persist fallback or partial reply', async () => {
  const res = fakeRes()
  async function* boom() {
    throw new Error('provider down')
  }
  const result = await streamChatReply(res, {
    messages: [],
    fallbackReply: 'FALLBACK_SHOULD_NOT_SAVE',
    streamFn: boom,
    signal: AbortSignal.abort(),
  })
  assert.equal(result.aborted, true)
  assert.equal(result.reply, '')
  assert.equal(shouldPersistStreamedReply(result), false)
  assert.equal(res.chunks.join('').includes('FALLBACK_SHOULD_NOT_SAVE'), false)
})

test('provider connection error releases the lock and may persist fallback', async () => {
  const key = `user:err-${Date.now()}`
  const res = fakeRes()
  async function* boom() {
    throw new Error('ECONNRESET')
  }
  const lock = await withProcessingLock(key, () =>
    streamChatReply(res, {
      messages: [],
      streamFn: boom,
      fallbackReply: 'FALLBACK_OK',
    }),
  )
  assert.equal(lock.locked, false)
  assert.equal(lock.result.aborted, false)
  assert.equal(lock.result.reply, 'FALLBACK_OK')
  assert.equal(shouldPersistStreamedReply(lock.result), true)
  assert.equal(isProcessing(key), false)
})

test('client abort releases the processing lock and skips persist', async () => {
  const key = `user:abort-${Date.now()}`
  const controller = new AbortController()
  const res = fakeRes()

  async function* hang({ signal }) {
    yield 'partial'
    await new Promise((_, reject) => {
      const fail = () => reject(abortErr())
      if (signal.aborted) return fail()
      signal.addEventListener('abort', fail, { once: true })
    })
  }

  const running = withProcessingLock(key, () =>
    streamChatReply(res, {
      messages: [],
      streamFn: hang,
      signal: controller.signal,
      fallbackReply: 'FALLBACK',
    }),
  )

  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(isProcessing(key), true)
  controller.abort()
  const lock = await running
  assert.equal(lock.locked, false)
  assert.equal(lock.result.aborted, true)
  assert.equal(shouldPersistStreamedReply(lock.result), false)
  assert.equal(isProcessing(key), false)
})

test('aborting one user lock does not cancel another session', async () => {
  const keyA = `user:a-${Date.now()}`
  const keyB = `user:b-${Date.now()}`
  const controllerA = new AbortController()
  const resA = fakeRes()
  const resB = fakeRes()

  async function* hang({ signal }) {
    await new Promise((_, reject) => {
      const fail = () => reject(abortErr())
      if (signal.aborted) return fail()
      signal.addEventListener('abort', fail, { once: true })
    })
  }
  async function* ok() {
    await new Promise((resolve) => setTimeout(resolve, 40))
    yield 'ok-b'
  }

  const runA = withProcessingLock(keyA, () =>
    streamChatReply(resA, { messages: [], streamFn: hang, signal: controllerA.signal }),
  )
  const runB = withProcessingLock(keyB, () => streamChatReply(resB, { messages: [], streamFn: ok }))

  await new Promise((resolve) => setTimeout(resolve, 15))
  controllerA.abort()
  const [a, b] = await Promise.all([runA, runB])
  assert.equal(a.result.aborted, true)
  assert.equal(b.result.aborted, false)
  assert.equal(b.result.reply, 'ok-b')
  assert.equal(isProcessing(keyA), false)
  assert.equal(isProcessing(keyB), false)
})

test('request close after the body is read is not treated as cancel', () => {
  const req = fakeReq()
  const res = fakeRes()
  const handle = attachClientAbort(req, res)
  req.emit('close')
  assert.equal(handle.signal.aborted, false)
  res.writableEnded = true
  res.emit('close')
  assert.equal(handle.signal.aborted, false)
  handle.dispose()
})

test('response close before end is treated as client disconnect', () => {
  const req = fakeReq()
  const res = fakeRes()
  const handle = attachClientAbort(req, res)
  assert.equal(handle.signal.aborted, false)
  res.emit('close')
  assert.equal(handle.signal.aborted, true)
  handle.dispose()
})

test('req aborted event is treated as cancel', () => {
  const req = fakeReq()
  const res = fakeRes()
  const handle = attachClientAbort(req, res)
  req.emit('aborted')
  assert.equal(handle.signal.aborted, true)
  handle.dispose()
})

test('provider timeout defaults stay bounded', () => {
  const prevStream = process.env.OPENAI_STREAM_TIMEOUT_MS
  const prevComplete = process.env.OPENAI_COMPLETE_TIMEOUT_MS
  delete process.env.OPENAI_STREAM_TIMEOUT_MS
  delete process.env.OPENAI_COMPLETE_TIMEOUT_MS
  assert.equal(streamTimeoutMs(), DEFAULT_STREAM_TIMEOUT_MS)
  assert.equal(completeTimeoutMs(), DEFAULT_COMPLETE_TIMEOUT_MS)
  process.env.OPENAI_STREAM_TIMEOUT_MS = '15000'
  assert.equal(streamTimeoutMs(), 15_000)
  process.env.OPENAI_STREAM_TIMEOUT_MS = '40'
  assert.equal(streamTimeoutMs(), DEFAULT_STREAM_TIMEOUT_MS)
  if (prevStream == null) delete process.env.OPENAI_STREAM_TIMEOUT_MS
  else process.env.OPENAI_STREAM_TIMEOUT_MS = prevStream
  if (prevComplete == null) delete process.env.OPENAI_COMPLETE_TIMEOUT_MS
  else process.env.OPENAI_COMPLETE_TIMEOUT_MS = prevComplete
})

test('openai stream aborts a hanging fetch via caller signal', async () => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-not-real'
  const origFetch = global.fetch
  const controller = new AbortController()
  global.fetch = (_url, opts) =>
    new Promise((_, reject) => {
      const fail = () => reject(abortErr())
      if (opts.signal?.aborted) return fail()
      opts.signal?.addEventListener('abort', fail, { once: true })
    })

  try {
    const pending = (async () => {
      for await (const chunk of openaiChatStream({
        messages: [{ role: 'user', content: 'hi' }],
        signal: controller.signal,
      })) {
        void chunk
      }
    })()
    controller.abort()
    await assert.rejects(() => pending, isAbortError)
  } finally {
    global.fetch = origFetch
  }
})

test('openai complete aborts a hanging fetch via caller signal', async () => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-not-real'
  const origFetch = global.fetch
  const controller = new AbortController()
  global.fetch = (_url, opts) =>
    new Promise((_, reject) => {
      const fail = () => reject(abortErr())
      if (opts.signal?.aborted) return fail()
      opts.signal?.addEventListener('abort', fail, { once: true })
    })

  try {
    const pending = openaiChatComplete({
      messages: [{ role: 'user', content: 'hi' }],
      signal: controller.signal,
    })
    controller.abort()
    await assert.rejects(() => pending, isAbortError)
  } finally {
    global.fetch = origFetch
  }
})

test('authed send inserts the user row before streaming and skips assistant persist on abort', () => {
  const send = fs.readFileSync(path.join(__dirname, '../../pages/api/chat/send.js'), 'utf8')
  const userIdx = send.indexOf("insertChatMessage(payload.id, 'user'")
  const streamIdx = send.indexOf('streamChatReply(')
  const persistIdx = send.indexOf('if (shouldPersistStreamedReply')
  assert.ok(userIdx > 0 && streamIdx > userIdx)
  assert.ok(persistIdx > streamIdx)
})
