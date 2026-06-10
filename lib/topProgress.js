const SHOW_DELAY_MS = 80
const FADE_MS = 200
const COMPLETE_WIDTH_MS = 300
const TICK_MS = 50

let taskCount = 0
const subscribers = new Set()

let delayTimer = null
let progressTimer = null
let fadeTimer = null
let completeTimer = null
let loadStartedAt = 0
let shown = false

let state = {
  visible: false,
  opacity: 0,
  width: 0,
  completing: false,
}

function emit() {
  subscribers.forEach((fn) => fn(state))
}

function clearTimers() {
  if (delayTimer) {
    clearTimeout(delayTimer)
    delayTimer = null
  }
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  if (fadeTimer) {
    clearTimeout(fadeTimer)
    fadeTimer = null
  }
  if (completeTimer) {
    clearTimeout(completeTimer)
    completeTimer = null
  }
}

function tickProgress() {
  if (!shown || taskCount === 0) return
  const elapsed = Date.now() - loadStartedAt
  const width = Math.max(
    8,
    Math.min(90, 90 * (1 - Math.exp(-elapsed / 1800))),
  )
  state = { ...state, width, completing: false }
  emit()
}

function finish() {
  if (!shown) {
    clearTimers()
    return
  }

  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }

  state = { ...state, width: 100, completing: true }
  emit()

  completeTimer = setTimeout(() => {
    state = { ...state, opacity: 0 }
    emit()
    fadeTimer = setTimeout(() => {
      shown = false
      state = { visible: false, opacity: 0, width: 0, completing: false }
      emit()
    }, FADE_MS)
  }, COMPLETE_WIDTH_MS)
}

export const topProgress = {
  subscribe(fn) {
    subscribers.add(fn)
    fn(state)
    return () => subscribers.delete(fn)
  },

  start() {
    taskCount += 1
    if (taskCount !== 1) return

    loadStartedAt = Date.now()
    delayTimer = setTimeout(() => {
      delayTimer = null
      if (taskCount <= 0) return

      shown = true
      state = { visible: true, opacity: 1, width: 8, completing: false }
      emit()
      tickProgress()
      progressTimer = setInterval(tickProgress, TICK_MS)
    }, SHOW_DELAY_MS)
  },

  done() {
    taskCount = Math.max(0, taskCount - 1)
    if (taskCount !== 0) return

    if (delayTimer) {
      clearTimeout(delayTimer)
      delayTimer = null
      return
    }

    finish()
  },

  /** End any in-flight progress (e.g. after route change completes). */
  complete() {
    taskCount = 0
    if (delayTimer) {
      clearTimeout(delayTimer)
      delayTimer = null
    }
    finish()
  },
}
