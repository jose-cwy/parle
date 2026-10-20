const test = require('node:test')
const assert = require('node:assert/strict')
const { authorizeCron, readProvidedCronSecret } = require('../../lib/parle/cronAuth')

test('cron fails closed when CRON_SECRET is missing', () => {
  const result = authorizeCron({ headers: {} }, {})
  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
})

test('cron fails closed when CRON_SECRET is blank', () => {
  const result = authorizeCron({ headers: { authorization: 'Bearer anything' } }, { CRON_SECRET: '   ' })
  assert.equal(result.ok, false)
  assert.equal(result.status, 503)
})

test('cron rejects an incorrect bearer token', () => {
  const result = authorizeCron(
    { headers: { authorization: 'Bearer wrong' } },
    { CRON_SECRET: 'expected-secret' },
  )
  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
})

test('cron allows a matching bearer token', () => {
  const result = authorizeCron(
    { headers: { authorization: 'Bearer expected-secret' } },
    { CRON_SECRET: 'expected-secret' },
  )
  assert.equal(result.ok, true)
})

test('readProvidedCronSecret prefers Authorization over query', () => {
  assert.equal(
    readProvidedCronSecret({
      headers: { authorization: 'Bearer from-header' },
      query: { secret: 'from-query' },
    }),
    'from-header',
  )
})
