const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const {
  parseGraceUntil,
  isAuthGraceActive,
  adminRequireVerifiedEmail,
  sessionAllowsApp,
  mustVerifyToUseApp,
  googleEmailTrusted,
} = require('../../lib/parle/authAccess')
const {
  normalizeEmail,
  hashToken,
  createRawToken,
  reclaimDecision,
  classifyConsumeMiss,
  timingSafeEqualHex,
} = require('../../lib/parle/authChallenges')
const { sqlIsAdditive, isForbiddenPrimaryMigration } = require('../../scripts/migrate')
const { hasFlag } = require('../../scripts/auth-account-inventory')

test('grace stays on until a UTC date is configured and has passed', () => {
  assert.equal(parseGraceUntil({}).configured, false)
  assert.equal(isAuthGraceActive({}), true)
  assert.equal(isAuthGraceActive({ PARLE_AUTH_GRACE_UNTIL: '2099-01-01' }), true)
  assert.equal(isAuthGraceActive({ PARLE_AUTH_GRACE_UNTIL: '2020-01-01' }), false)
})

test('admin verified-email enforcement is off unless explicitly enabled', () => {
  assert.equal(adminRequireVerifiedEmail({}), false)
  assert.equal(adminRequireVerifiedEmail({ PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL: 'true' }), true)
})

test('unverified users keep app access only while grace is active', () => {
  const user = { email_verified_at: null }
  assert.equal(sessionAllowsApp(user, {}), true)
  assert.equal(mustVerifyToUseApp(user, { PARLE_AUTH_GRACE_UNTIL: '2020-01-01' }), true)
  assert.equal(sessionAllowsApp({ email_verified_at: '2026-01-01' }, { PARLE_AUTH_GRACE_UNTIL: '2020-01-01' }), true)
})

test('Google email is trusted only for verified Gmail or Workspace hd', () => {
  assert.equal(googleEmailTrusted({ email: 'a@gmail.com', email_verified: true }), true)
  assert.equal(googleEmailTrusted({ email: 'a@yahoo.com', email_verified: true }), false)
  assert.equal(googleEmailTrusted({ email: 'a@company.com', email_verified: true, hd: 'company.com' }), true)
  assert.equal(googleEmailTrusted({ email: 'a@gmail.com', email_verified: false }), false)
})

test('emails are normalized and tokens hash uniquely', () => {
  assert.equal(normalizeEmail('  A@Parle.Chat '), 'a@parle.chat')
  assert.equal(normalizeEmail('bad'), null)
  const a = createRawToken()
  const b = createRawToken()
  assert.notEqual(a, b)
  assert.equal(hashToken(a).length, 64)
  assert.notEqual(hashToken(a), hashToken(b))
})

test('0004 is additive and not a forbidden primary 0001/0002 file', () => {
  const sql = fs.readFileSync(
    path.join(__dirname, '../../database/migrations/0004_auth_identities.sql'),
    'utf8',
  )
  assert.equal(sqlIsAdditive(sql), true)
  assert.equal(isForbiddenPrimaryMigration('0004_auth_identities.sql'), false)
  assert.match(sql, /email_verified_at/)
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i)
})

test('inventory script refuses to start without --read-only', () => {
  assert.equal(hasFlag(['--rehearsal'], '--read-only'), false)
  assert.equal(hasFlag(['--read-only', '--rehearsal'], '--read-only'), true)
})

test('consume miss reasons distinguish used vs expired vs invalid', () => {
  const now = new Date('2026-10-22T00:00:00.000Z')
  assert.equal(classifyConsumeMiss(null, now), 'invalid')
  assert.equal(classifyConsumeMiss({ consumed_at: now, expires_at: '2026-10-23T00:00:00.000Z' }, now), 'used')
  assert.equal(classifyConsumeMiss({ consumed_at: null, expires_at: '2026-10-21T00:00:00.000Z' }, now), 'expired')
})

test('stale reclaim never takes over verified or fresh or data-bearing accounts', () => {
  const now = new Date('2026-10-22T00:00:00.000Z')
  assert.equal(reclaimDecision(null, 0, now).action, 'insert')
  assert.equal(reclaimDecision({ email_verified_at: now, created_at: '2026-01-01' }, 0, now).action, 'exists_verified')
  assert.equal(reclaimDecision({ email_verified_at: null, created_at: '2026-10-21T12:00:00.000Z' }, 0, now).action, 'pending')
  assert.equal(reclaimDecision({ email_verified_at: null, created_at: '2026-10-20T00:00:00.000Z' }, 2, now).action, 'has_data')
  assert.equal(reclaimDecision({ email_verified_at: null, created_at: '2026-10-20T00:00:00.000Z' }, 0, now).action, 'reclaim')
})

test('token hash compare rejects different lengths without throwing', () => {
  assert.equal(timingSafeEqualHex('ab', 'ab'), true)
  assert.equal(timingSafeEqualHex('ab', 'abcd'), false)
})

test('admin flag stays off for empty and non-true values', () => {
  assert.equal(adminRequireVerifiedEmail({ PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL: 'false' }), false)
  assert.equal(adminRequireVerifiedEmail({ PARLE_ADMIN_REQUIRE_VERIFIED_EMAIL: '1' }), true)
})

test('preflight script also requires --read-only', () => {
  const { hasFlag: preflightFlag } = require('../../scripts/auth-migration-preflight')
  assert.equal(preflightFlag(['--rehearsal'], '--read-only'), false)
  assert.equal(preflightFlag(['--read-only'], '--read-only'), true)
})
