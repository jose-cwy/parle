const test = require('node:test')
const assert = require('node:assert/strict')
const { SCENARIOS, THINK_COMPARE_IDS } = require('../../lib/parle/eval/scenarios')
const { scoreReply } = require('../../lib/parle/eval/score')

test('Phase 2 suite covers six modes with at least 30 scenarios', () => {
  const modes = new Set(SCENARIOS.map((s) => s.modeId))
  assert.equal(SCENARIOS.length >= 30, true)
  for (const mode of ['cross', 'emotional', 'logical', 'vent', 'stop_contact', 'talk']) {
    assert.equal(modes.has(mode), true, `missing ${mode}`)
    assert.equal(SCENARIOS.filter((s) => s.modeId === mode).length >= 5, true)
  }
  assert.equal(THINK_COMPARE_IDS.length >= 12, true)
})

test('vent heuristic deducts unsolicited questions', () => {
  const scenario = SCENARIOS.find((s) => s.id === 'vent-hate-happy')
  const bad = scoreReply(scenario, 'that sucks. what happened next?')
  assert.equal(bad.deductions.includes('vent_or_no_question_failed'), true)
  const good = scoreReply(scenario, 'you did everything and they just walked. infuriating.')
  assert.equal(good.deductions.includes('vent_or_no_question_failed'), false)
})
