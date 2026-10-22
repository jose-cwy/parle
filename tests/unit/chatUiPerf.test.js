const test = require('node:test')
const assert = require('node:assert/strict')
const {
  patchStreamingAssistantMessage,
  isNearBottom,
  createAnimationFrameBatcher,
  createThrottledRunner,
} = require('../../lib/parle/chatUiPerf')

test('patchStreamingAssistantMessage replaces only the streaming turn', () => {
  const first = { id: 'a', role: 'user', text: 'hi', at: 1 }
  const second = { id: 'b', role: 'assistant', text: 'he', at: 2, modeId: 'cross' }
  const list = [first, second]
  const next = patchStreamingAssistantMessage(list, {
    at: 2,
    text: 'hello',
    modeId: 'cross',
  })
  assert.equal(next.length, 2)
  assert.equal(next[0], first)
  assert.notEqual(next[1], second)
  assert.equal(next[1].text, 'hello')
  assert.equal(next[1].id, 'b')
})

test('patchStreamingAssistantMessage is a no-op when text is unchanged', () => {
  const list = [{ id: 'b', role: 'assistant', text: 'hello', at: 2, modeId: 'cross' }]
  const next = patchStreamingAssistantMessage(list, { at: 2, text: 'hello', modeId: 'cross' })
  assert.equal(next, list)
})

test('isNearBottom uses a stickiness threshold', () => {
  assert.equal(isNearBottom({ scrollHeight: 1000, scrollTop: 920, clientHeight: 80 }, 96), true)
  assert.equal(isNearBottom({ scrollHeight: 1000, scrollTop: 100, clientHeight: 80 }, 96), false)
})

test('animation frame batcher keeps the latest value and can flush immediately', () => {
  const calls = []
  let pending = null
  const batcher = createAnimationFrameBatcher((value) => calls.push(value), {
    raf: (cb) => {
      pending = cb
      return 1
    },
    caf: () => {
      pending = null
    },
  })

  batcher.schedule('a')
  batcher.schedule('b')
  batcher.schedule('c')
  assert.deepEqual(calls, [])
  pending()
  assert.deepEqual(calls, ['c'])
  assert.equal(batcher.getFlushCount(), 1)

  batcher.schedule('d')
  batcher.flush()
  assert.deepEqual(calls, ['c', 'd'])
})

test('throttled runner coalesces calls and flushes the last pending run', () => {
  let runs = 0
  let pending = null
  const runner = createThrottledRunner(() => {
    runs += 1
  }, 50, {
    setTimeout: (cb) => {
      pending = cb
      return 1
    },
    clearTimeout: () => {
      pending = null
    },
  })

  runner.schedule()
  runner.schedule()
  runner.schedule()
  assert.equal(runs, 0)
  pending()
  assert.equal(runs, 1)
  runner.schedule()
  runner.flush()
  assert.equal(runs, 2)
})
