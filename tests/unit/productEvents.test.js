const test = require('node:test')
const assert = require('node:assert/strict')
const { sanitizeEvent, shouldRecordGuestMessageSent } = require('../../lib/parle/productEvents')
const { isExcludedMetricsEmail, isAdminEmail } = require('../../lib/parle/metricsExclude')
const { sqlIsAdditive, isForbiddenPrimaryMigration } = require('../../scripts/migrate')
const fs = require('fs')
const path = require('path')
const { summarizeOutcome, pct } = require('../../lib/parle/insights')

test('guest message_sent is only for accepted normal turns', () => {
  assert.equal(shouldRecordGuestMessageSent({ kind: 'normal' }), true)
  assert.equal(shouldRecordGuestMessageSent({ kind: 'normal', locked: false }), true)
  assert.equal(shouldRecordGuestMessageSent({ kind: 'crisis' }), false)
  assert.equal(shouldRecordGuestMessageSent({ kind: 'guardrail' }), false)
  assert.equal(shouldRecordGuestMessageSent({ kind: 'normal', locked: true }), false)
  assert.equal(shouldRecordGuestMessageSent({ kind: 'normal', rejected: true }), false)
  assert.equal(shouldRecordGuestMessageSent({ kind: 'rejected' }), false)
})

test('sanitizeEvent drops unknown names and guest session keys', () => {
  assert.equal(sanitizeEvent({ name: 'chat_send', userId: 'x' }), null)
  const guest = sanitizeEvent({
    name: 'message_sent',
    isGuest: true,
    sessionKey: 'guest-token-should-drop',
    modeId: 'cross',
    ip: '1.2.3.4',
    text: 'secret chat',
  })
  assert.equal(guest.sessionKey, null)
  assert.equal(guest.isGuest, true)
  assert.equal(guest.userId, null)
  assert.equal(guest.text, undefined)
  assert.equal(guest.ip, undefined)
  const authed = sanitizeEvent({
    name: 'message_sent',
    userId: '11111111-1111-4111-8111-111111111111',
    sessionKey: 'session-a',
    isGuest: false,
  })
  assert.equal(authed.sessionKey, 'session-a')
  assert.equal(authed.userId, '11111111-1111-4111-8111-111111111111')
})

test('test accounts are excluded from official metrics', () => {
  assert.equal(isExcludedMetricsEmail('testuser_a@parle.test'), true)
  assert.equal(isExcludedMetricsEmail('founder@parle.chat', { METRICS_EXCLUDE_EMAILS: '' }), false)
  assert.equal(isAdminEmail('a@x.com', { ADMIN_EMAILS: 'a@x.com' }), true)
  assert.equal(isAdminEmail('a@x.com', { ADMIN_EMAILS: 'b@x.com' }), false)
})

test('0003 sql is additive and 0001/0002 cannot be authorized', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../database/migrations/0003_phase3_analytics.sql'), 'utf8')
  assert.equal(sqlIsAdditive(sql), true)
  assert.equal(isForbiddenPrimaryMigration('0003_phase3_analytics.sql'), false)
  assert.equal(isForbiddenPrimaryMigration('0001_keep_comments.sql'), true)
  assert.equal(isForbiddenPrimaryMigration('0002_archive_legacy.sql'), true)
})

test('skip is not counted as Same', () => {
  const summary = summarizeOutcome(
    'relief',
    [{ dimension: 'relief', response: 'better', n: 2 }],
    [
      { name: 'survey_shown', n: 5 },
      { name: 'survey_skipped', dimension: 'all', n: 3 },
    ],
  )
  assert.equal(summary.answered, 2)
  assert.equal(summary.skipped, 3)
  assert.equal(summary.options.same, undefined)
  assert.equal(pct(2, 5), 40)
})
