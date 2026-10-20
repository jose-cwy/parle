const test = require('node:test')
const assert = require('node:assert/strict')
const { hiddenThinkEnabled, shouldRunHiddenThink } = require('../../lib/parle/hiddenThink')

test('hidden think is off unless PARLE_HIDDEN_THINK is on', () => {
  assert.equal(hiddenThinkEnabled({}), false)
  assert.equal(hiddenThinkEnabled({ PARLE_HIDDEN_THINK: 'off' }), false)
  assert.equal(hiddenThinkEnabled({ PARLE_HIDDEN_THINK: 'on' }), true)
  assert.equal(shouldRunHiddenThink('cross', { PARLE_HIDDEN_THINK: 'off' }), false)
  assert.equal(shouldRunHiddenThink('cross', { PARLE_HIDDEN_THINK: 'on' }), true)
  assert.equal(shouldRunHiddenThink('vent', { PARLE_HIDDEN_THINK: 'on' }), false)
  assert.equal(shouldRunHiddenThink('talk', { PARLE_HIDDEN_THINK: 'on' }), false)
})
