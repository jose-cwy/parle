const test = require('node:test')
const assert = require('node:assert/strict')
const { parseAdminRange } = require('../../lib/parle/adminRange')
const { pickUserRow, USER_LIST_FIELDS, loadAiStatus, pct } = require('../../lib/parle/adminMetrics')
const { withAdminFlag, requireAdminUser } = require('../../lib/parle/adminAuth')
const { isUuid } = require('../../lib/parle/adminPage')

test('admin routes are not mixed into the consumer app shell', async () => {
  const {
    APP_ROUTES,
    isAppRoute,
    isAdminRoute,
    postLoginPath,
    shouldShowInsightsNav,
  } = await import('../../lib/routes.js')
  assert.equal(APP_ROUTES.includes('/admin'), false)
  assert.equal(isAppRoute('/admin'), false)
  assert.equal(isAppRoute('/admin/users'), false)
  assert.equal(isAdminRoute('/admin'), true)
  assert.equal(isAdminRoute('/admin/users/abc'), true)
  assert.equal(isAdminRoute('/dashboard'), false)
  const admin = { isAdmin: true, preferred_name: 'Ada' }
  const member = { isAdmin: false, preferred_name: 'Ada' }
  assert.equal(postLoginPath(admin), '/admin')
  assert.equal(postLoginPath(member), '/dashboard')
  assert.equal(postLoginPath(admin, '/journal'), '/journal')
  assert.equal(postLoginPath(admin, '/login'), '/admin')
  assert.equal(shouldShowInsightsNav(admin), true)
  assert.equal(shouldShowInsightsNav(member), false)
  assert.equal(shouldShowInsightsNav({ isAdmin: 'true' }), false)
})

test('withAdminFlag is derived from ADMIN_EMAILS only', () => {
  const env = { ADMIN_EMAILS: 'founder@parle.chat' }
  assert.equal(withAdminFlag({ email: 'founder@parle.chat' }, env).isAdmin, true)
  assert.equal(withAdminFlag({ email: 'member@example.com' }, env).isAdmin, false)
  assert.equal(withAdminFlag({ email: 'founder@parle.chat', isAdmin: true }, { ADMIN_EMAILS: '' }).isAdmin, false)
})

test('parseAdminRange supports presets and bounded custom ranges', () => {
  const thirty = parseAdminRange({ range: '30' })
  assert.equal(thirty.range, '30')
  assert.equal(thirty.days, 30)
  assert.ok(thirty.from <= thirty.to)
  const custom = parseAdminRange({ range: 'custom', from: '2026-01-01', to: '2026-01-10' })
  assert.equal(custom.range, 'custom')
  assert.equal(custom.days, 10)
  const wide = parseAdminRange({ range: 'custom', from: '2020-01-01', to: '2026-01-01' })
  assert.ok(wide.days <= 366)
})

test('user directory rows never include secrets or transcripts', () => {
  const row = pickUserRow({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'a@b.com',
    created_at: '2026-01-01',
    first_activated_at: null,
    last_active_at: null,
    messages: 3,
    conversations: 1,
    memory_enabled: true,
    personalisation_enabled: false,
    password_hash: 'secret',
    transcript: 'nope',
    living_profile: {},
  })
  assert.deepEqual(Object.keys(row).sort(), [...USER_LIST_FIELDS].sort())
  assert.equal(row.password_hash, undefined)
  assert.equal(row.transcript, undefined)
})

test('uuid gate and unavailable AI metrics', () => {
  assert.equal(isUuid('11111111-1111-4111-8111-111111111111'), true)
  assert.equal(isUuid('not-a-uuid'), false)
  const ai = loadAiStatus({ OPENAI_MODEL: 'gpt-4o-mini', PARLE_HIDDEN_THINK: 'on' })
  assert.equal(ai.latency.status, 'not_recorded')
  assert.equal(ai.errors.status, 'not_recorded')
  assert.equal(ai.cost.status, 'not_recorded')
  assert.equal(ai.hiddenThink, true)
  assert.equal(pct(1, 4), 25)
  assert.equal(pct(1, 0), null)
})

test('requireAdminUser ignores client flags and missing sessions', async () => {
  const missing = await requireAdminUser(null, { ADMIN_EMAILS: 'a@x.com' })
  assert.equal(missing.ok, false)
  assert.equal(missing.status, 404)
})
