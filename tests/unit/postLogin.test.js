import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_INSIGHTS_PATH,
  isProtectedAppRoute,
  postLoginPath,
  shouldShowInsightsNav,
} from '../../lib/routes.js'
import { withAdminFlag } from '../../lib/parle/adminAuth.js'

const named = { preferred_name: 'Ada', email: 'ada@parle.chat' }

test('admin login without next goes to insights', () => {
  assert.equal(postLoginPath({ ...named, isAdmin: true }), ADMIN_INSIGHTS_PATH)
})

test('normal login without next goes to dashboard', () => {
  assert.equal(postLoginPath({ ...named, isAdmin: false }), '/dashboard')
  assert.equal(postLoginPath(named), '/dashboard')
})

test('client-supplied admin-looking email is not trusted without isAdmin', () => {
  assert.equal(
    postLoginPath({ preferred_name: 'Founder', email: 'founder@parle.chat', isAdmin: false }),
    '/dashboard',
  )
})

test('intended destination wins for admin and normal users', () => {
  assert.equal(postLoginPath({ ...named, isAdmin: true }, '/journal'), '/journal')
  assert.equal(postLoginPath({ ...named, isAdmin: false }, '/quotes'), '/quotes')
  assert.equal(postLoginPath({ ...named, isAdmin: true }, '/admin/insights'), ADMIN_INSIGHTS_PATH)
})

test('blocked next does not loop back to login', () => {
  assert.equal(postLoginPath({ ...named, isAdmin: true }, '/login'), '/dashboard')
  assert.equal(postLoginPath({ ...named, isAdmin: true }, '//evil.example'), '/dashboard')
})

test('users without a preferred name still go to welcome', () => {
  assert.equal(postLoginPath({ email: 'ada@parle.chat', isAdmin: true }), '/welcome')
})

test('Insights nav is only for server isAdmin flag', () => {
  assert.equal(shouldShowInsightsNav({ email: 'founder@parle.chat' }), false)
  assert.equal(shouldShowInsightsNav({ email: 'founder@parle.chat', isAdmin: true }), true)
  assert.equal(shouldShowInsightsNav({ isAdmin: false }), false)
  assert.equal(shouldShowInsightsNav(null), false)
})

test('admin insights route stays behind app auth', () => {
  assert.equal(isProtectedAppRoute('/admin/insights'), true)
  assert.equal(isProtectedAppRoute('/dashboard'), true)
  assert.equal(isProtectedAppRoute('/chat'), false)
})

test('withAdminFlag uses ADMIN_EMAILS and never copies the allowlist', () => {
  const env = { ADMIN_EMAILS: 'founder@parle.chat, ops@parle.chat' }
  const admin = withAdminFlag({ id: '1', email: 'founder@parle.chat', preferred_name: 'Jose' }, env)
  const member = withAdminFlag({ id: '2', email: 'ada@parle.chat', preferred_name: 'Ada' }, env)
  assert.equal(admin.isAdmin, true)
  assert.equal(member.isAdmin, false)
  assert.equal(Object.prototype.hasOwnProperty.call(admin, 'ADMIN_EMAILS'), false)
  assert.equal(JSON.stringify(admin).includes('ops@parle.chat'), false)
})
