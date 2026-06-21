const test = require('node:test')
const assert = require('node:assert/strict')
const { sanitizeSessionTitle, getUserPronoun } = require('../../lib/parle/sessionTitle')

test('getUserPronoun prefers them when user says them', () => {
  assert.equal(getUserPronoun(['i miss them so much']), 'them')
})

test('getUserPronoun prefers her when user says her', () => {
  assert.equal(getUserPronoun(['i miss her']), 'her')
})

test('sanitizeSessionTitle replaces hallucinated names after of', () => {
  const title = sanitizeSessionTitle('missing memories of alex', ['i miss them'])
  assert.equal(title, 'missing memories of them')
})

test('sanitizeSessionTitle keeps names the user actually said', () => {
  const title = sanitizeSessionTitle('missing memories of sarah', ['i miss sarah every day'])
  assert.equal(title, 'missing memories of sarah')
})

test('sanitizeSessionTitle keeps neutral pronouns from the model', () => {
  const title = sanitizeSessionTitle('still hurting over them', ['i miss them'])
  assert.equal(title, 'still hurting over them')
})

test('sanitizeSessionTitle replaces guessed names after about', () => {
  const title = sanitizeSessionTitle('thinking about jordan', ['i miss him'])
  assert.equal(title, 'thinking about him')
})
