const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getOnboardingContextInjection,
  isValidOnboardingReason,
} = require('../../lib/parle/onboarding')

test('isValidOnboardingReason accepts known values', () => {
  assert.equal(isValidOnboardingReason('heartbreak'), true)
  assert.equal(isValidOnboardingReason('friendship_family'), true)
  assert.equal(isValidOnboardingReason('just_talking'), true)
  assert.equal(isValidOnboardingReason('skipped'), true)
  assert.equal(isValidOnboardingReason('other'), false)
})

test('getOnboardingContextInjection returns context for answers only', () => {
  assert.match(getOnboardingContextInjection('heartbreak'), /heartbreak or breakup/)
  assert.match(getOnboardingContextInjection('friendship_family'), /friendship or family/)
  assert.match(getOnboardingContextInjection('just_talking'), /somewhere to talk/)
  assert.equal(getOnboardingContextInjection('skipped'), null)
})
