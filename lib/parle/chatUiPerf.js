const STREAM_PERSIST_MS = 2000
const FOLLOW_BOTTOM_PX = 96

function patchStreamingAssistantMessage(messages, { at, text, modeId, id } = {}) {
  const list = messages || []
  if (!list.length || at == null) return list

  let index = -1
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i]
    if (message?.role === 'assistant' && message.at === at) {
      index = i
      break
    }
  }
  if (index === -1) return list

  const current = list[index]
  const nextId = id || current.id
  if (
    current.text === text &&
    current.modeId === (modeId || current.modeId) &&
    current.id === nextId
  ) {
    return list
  }

  const next = list.slice()
  next[index] = {
    ...current,
    text,
    ...(modeId ? { modeId } : {}),
    ...(nextId ? { id: nextId } : {}),
  }
  return next
}

function isNearBottom(metrics, thresholdPx = FOLLOW_BOTTOM_PX) {
  if (!metrics) return true
  const scrollHeight = Number(metrics.scrollHeight) || 0
  const scrollTop = Number(metrics.scrollTop) || 0
  const clientHeight = Number(metrics.clientHeight) || 0
  return scrollHeight - scrollTop - clientHeight <= thresholdPx
}

function createAnimationFrameBatcher(apply, timers = {}) {
  const raf = timers.raf || ((cb) => setTimeout(() => cb(Date.now()), 16))
  const caf = timers.caf || ((id) => clearTimeout(id))
  let latest = null
  let id = 0
  let flushed = 0

  return {
    schedule(value) {
      latest = value
      if (id) return
      id = raf(() => {
        id = 0
        const next = latest
        latest = null
        if (next == null) return
        flushed += 1
        apply(next)
      })
    },
    flush() {
      if (id) {
        caf(id)
        id = 0
      }
      if (latest == null) return
      const next = latest
      latest = null
      flushed += 1
      apply(next)
    },
    cancel() {
      if (id) {
        caf(id)
        id = 0
      }
      latest = null
    },
    getFlushCount() {
      return flushed
    },
    hasPending() {
      return latest != null || Boolean(id)
    },
  }
}

function createThrottledRunner(run, waitMs = STREAM_PERSIST_MS, timers = {}) {
  const scheduleTimeout = timers.setTimeout || setTimeout
  const clear = timers.clearTimeout || clearTimeout
  let timer = null
  let pending = false

  return {
    schedule() {
      pending = true
      if (timer != null) return
      timer = scheduleTimeout(() => {
        timer = null
        if (!pending) return
        pending = false
        run()
      }, waitMs)
    },
    flush() {
      if (timer != null) {
        clear(timer)
        timer = null
      }
      if (!pending) return
      pending = false
      run()
    },
    cancel() {
      if (timer != null) {
        clear(timer)
        timer = null
      }
      pending = false
    },
  }
}

module.exports = {
  STREAM_PERSIST_MS,
  FOLLOW_BOTTOM_PX,
  patchStreamingAssistantMessage,
  isNearBottom,
  createAnimationFrameBatcher,
  createThrottledRunner,
}
