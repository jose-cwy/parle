const test = require('node:test')
const assert = require('node:assert/strict')
const userSettings = require('../../lib/parle/userSettings')

test('DEFAULT_USER_SETTINGS are all false', () => {
  assert.equal(userSettings.DEFAULT_USER_SETTINGS.memory_enabled, false)
  assert.equal(userSettings.DEFAULT_USER_SETTINGS.personalisation_enabled, false)
})

test('normalizeSettings coerces booleans', () => {
  const normalized = userSettings.normalizeSettings({
    memory_enabled: 1,
    personalisation_enabled: null,
  })
  assert.equal(normalized.memory_enabled, true)
  assert.equal(normalized.personalisation_enabled, false)
})
