const test = require('node:test')
const assert = require('node:assert/strict')
const { googleAccountDecision, oauthStateMatches } = require('../../lib/handlers/authGoogle')
const { googleRedirectUri } = require('../../lib/parle/googleAuth')
const { isGoogleSignInPublic } = require('../../lib/parle/authAccess')

test('test-mode Google codes round-trip through verifyIdToken', async () => {
  process.env.AUTH_TEST_GOOGLE = '1'
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'
  const { createTestGoogleCode, exchangeCode, verifyIdToken } = require('../../lib/parle/googleAuth')
  const code = createTestGoogleCode({
    sub: 'google-sub-1',
    email: 'person@gmail.com',
    email_verified: true,
    nonce: 'nonce-1',
  })
  const exchanged = await exchangeCode({ code, codeVerifier: 'x' })
  const claims = await verifyIdToken({ idToken: exchanged.id_token, nonce: 'nonce-1' })
  assert.equal(claims.sub, 'google-sub-1')
  assert.equal(claims.email, 'person@gmail.com')
  await assert.rejects(() => verifyIdToken({ idToken: exchanged.id_token, nonce: 'other' }))
})

test('oauth state compare rejects mismatches of equal and unequal length', () => {
  assert.equal(oauthStateMatches('abc', 'abc'), true)
  assert.equal(oauthStateMatches('abc', 'abd'), false)
  assert.equal(oauthStateMatches('abc', ''), false)
  assert.equal(oauthStateMatches('ab', 'abcd'), false)
})

test('Google account decisions never silently merge on email', () => {
  const verified = { email: 'a@gmail.com', email_verified_at: '2026-01-01' }
  assert.equal(googleAccountDecision({
    subject: '', email: 'a@gmail.com',
  }).action, 'error')
  assert.equal(googleAccountDecision({
    subject: 'sub-1',
    email: 'a@gmail.com',
    identityUserId: 'user-google',
    existingSessionId: 'user-other',
  }).redirect, '/login?auth=google_other_account')
  assert.equal(googleAccountDecision({
    subject: 'sub-1',
    email: 'a@gmail.com',
    identityUserId: 'user-google',
  }).action, 'signin')
  assert.equal(googleAccountDecision({
    subject: 'sub-1',
    email: 'a@gmail.com',
    existingSessionId: 'user-1',
    current: { email: 'a@gmail.com', email_verified_at: null },
  }).redirect, '/verify-email/pending?auth=verify_before_link')
  assert.equal(googleAccountDecision({
    subject: 'sub-1',
    email: 'a@gmail.com',
    existingSessionId: 'user-1',
    current: { email: 'other@gmail.com', email_verified_at: '2026-01-01' },
  }).redirect, '/login?auth=google_email_mismatch')
  assert.equal(googleAccountDecision({
    subject: 'sub-1',
    email: 'a@gmail.com',
    existingSessionId: 'user-1',
    current: verified,
  }).action, 'link')
  assert.equal(googleAccountDecision({
    subject: 'sub-1',
    email: 'a@gmail.com',
    emailOwnerId: 'existing-password-user',
  }).action, 'collision')
  assert.equal(googleAccountDecision({
    subject: 'sub-1',
    email: 'a@gmail.com',
  }).action, 'create')
})

test('production redirect URI is APP_URL plus callback path', () => {
  assert.equal(
    googleRedirectUri({ APP_URL: 'https://parle.chat' }),
    'https://parle.chat/api/auth/google/callback',
  )
})

test('Google button public flag can be forced off', () => {
  assert.equal(isGoogleSignInPublic({}), true)
  assert.equal(isGoogleSignInPublic({ NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN: 'false' }), false)
  assert.equal(isGoogleSignInPublic({ NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN: 'true' }), true)
})
