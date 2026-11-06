function abortError() {
  const error = new Error('aborted')
  error.name = 'AbortError'
  error.code = 'ABORT_ERR'
  return error
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(abortError())
      },
      { once: true },
    )
  })
}

function v2TestStreamFn(kind = 'ok') {
  if (kind === 'fail') {
    return async function* failStub() {
      throw new Error('provider_down')
    }
  }
  if (kind === 'timeout') {
    return async function* timeoutStub({ signal } = {}) {
      await wait(80, signal)
      const error = new Error('ETIMEDOUT')
      error.code = 'ETIMEDOUT'
      throw error
    }
  }
  if (kind === 'hang') {
    return async function* hangStub({ signal } = {}) {
      await new Promise((_, reject) => {
        if (signal?.aborted) {
          reject(abortError())
          return
        }
        signal?.addEventListener(
          'abort',
          () => {
            reject(abortError())
          },
          { once: true },
        )
      })
    }
  }
  if (kind === 'drip') {
    return async function* dripStub({ signal } = {}) {
      yield '…'
      await wait(2500, signal)
      yield 'stub-ok'
    }
  }
  if (kind === 'slow') {
    return async function* slowStub() {
      await new Promise((resolve) => setTimeout(resolve, 400))
      yield 'stub-slow'
    }
  }
  return async function* okStub() {
    yield 'stub-ok'
  }
}

function resolveV2StreamFn(req, env = process.env) {
  if (String(env.NODE_ENV || '') === 'production') return undefined
  if (env.PARLE_V2_TEST_STUB !== '1') return undefined
  const header = req?.headers?.['x-parle-v2-stub'] || req?.headers?.['X-Parle-V2-Stub']
  return v2TestStreamFn(String(header || req?.body?.testStub || 'ok'))
}

module.exports = {
  v2TestStreamFn,
  resolveV2StreamFn,
}
