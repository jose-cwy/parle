const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  isValidGuestEmail,
  getGuestEmailThreshold,
  shouldOfferBeforeunloadEmailPrompt,
  GUEST_EMAIL_THRESHOLD_DESKTOP,
  GUEST_EMAIL_THRESHOLD_MOBILE,
} = require('../../lib/parle/guestEmail')
const { isValidEmailFormat } = require('../../lib/parle/guestEmailsDb')

describe('isValidGuestEmail', () => {
  it('accepts a normal email', () => {
    assert.equal(isValidGuestEmail('hello@parle.chat'), true)
  })

  it('rejects missing @', () => {
    assert.equal(isValidGuestEmail('not-an-email'), false)
  })

  it('rejects empty values', () => {
    assert.equal(isValidGuestEmail(''), false)
    assert.equal(isValidGuestEmail('   '), false)
  })
})

describe('isValidEmailFormat (server)', () => {
  it('matches client validation', () => {
    assert.equal(isValidEmailFormat('user@example.com'), true)
    assert.equal(isValidEmailFormat('bad'), false)
  })
})

describe('guest email thresholds', () => {
  it('offers beforeunload below desktop threshold', () => {
    assert.equal(
      shouldOfferBeforeunloadEmailPrompt(GUEST_EMAIL_THRESHOLD_DESKTOP - 1),
      true,
    )
    assert.equal(
      shouldOfferBeforeunloadEmailPrompt(GUEST_EMAIL_THRESHOLD_DESKTOP),
      false,
    )
  })

  it('exposes desktop and mobile constants', () => {
    assert.equal(GUEST_EMAIL_THRESHOLD_DESKTOP, 8)
    assert.equal(GUEST_EMAIL_THRESHOLD_MOBILE, 5)
    assert.equal(typeof getGuestEmailThreshold(), 'number')
  })
})
