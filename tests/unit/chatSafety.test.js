const test = require('node:test')
const assert = require('node:assert/strict')
const {
  containsCrisisLanguage,
  CRISIS_SAFETY_REPLY,
} = require('../../lib/chatSafety')

test('CRISIS_SAFETY_REPLY includes Singapore crisis resources', () => {
  assert.match(CRISIS_SAFETY_REPLY, /1-767/)
  assert.match(CRISIS_SAFETY_REPLY, /6389 2222/)
  assert.match(CRISIS_SAFETY_REPLY, /chat\.mentalhealth\.sg/)
})

test('audit crisis phrases trigger detection', () => {
  assert.equal(containsCrisisLanguage("i've been hurting myself"), true)
  assert.equal(containsCrisisLanguage("i don't want to be here anymore"), true)
  assert.equal(containsCrisisLanguage('i just want to disappear'), true)
})

test('benign messages do not trigger crisis detection', () => {
  assert.equal(containsCrisisLanguage('having a rough day'), false)
  assert.equal(containsCrisisLanguage('what should i cook for dinner'), false)
})
