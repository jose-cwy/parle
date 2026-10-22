const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const userSettings = require('../../lib/parle/userSettings')

test('DEFAULT_USER_SETTINGS are on by default', () => {
  assert.equal(userSettings.DEFAULT_USER_SETTINGS.memory_enabled, true)
  assert.equal(userSettings.DEFAULT_USER_SETTINGS.personalisation_enabled, true)
})

test('defaults helper only coalesces SQL NULL, never overwrites FALSE', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../../lib/parle/userSettings.js'),
    'utf8',
  )
  assert.match(source, /memory_enabled = COALESCE\(memory_enabled, TRUE\)/)
  assert.match(source, /personalisation_enabled = COALESCE\(personalisation_enabled, TRUE\)/)
  assert.doesNotMatch(source, /memory_enabled = TRUE(?!\))/)
})

test('normalizeSettings coerces booleans', () => {
  const normalized = userSettings.normalizeSettings({
    memory_enabled: 1,
    personalisation_enabled: null,
  })
  assert.equal(normalized.memory_enabled, true)
  assert.equal(normalized.personalisation_enabled, false)
})
