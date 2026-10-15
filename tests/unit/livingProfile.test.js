const test = require('node:test')
const assert = require('node:assert/strict')
const { encrypt, decrypt, PREFIX } = require('../../lib/security/encryption')
const {
  emptyProfile,
  isSensitiveText,
  sanitizeFactText,
  bumpFact,
  deleteFactById,
  mergeExtractedFacts,
  mergeSessionSignals,
  factsForInjection,
  overlayPreferenceKnobs,
  buildLivingProfileBlock,
  toPublicItems,
  pickPatternToName,
} = require('../../lib/parle/livingProfileCore')
const { buildThinkBlock } = require('../../lib/parle/hiddenThink')
const { buildChatCompletionMessages } = require('../../lib/parle/chatComplete')
const { getLivingProfileForUser, deserializeProfile, serializeProfile } = require('../../lib/parle/livingProfile')

function twice(profile, args) {
  return bumpFact(bumpFact(profile, args), args)
}

test('sensitive health language is dropped and never stored', () => {
  assert.equal(isSensitiveText('I think I have depression'), true)
  assert.equal(sanitizeFactText('user mentioned anxiety after the breakup'), null)
  let profile = emptyProfile()
  profile = bumpFact(profile, {
    category: 'pattern',
    key: 'pattern:health',
    text: 'sounds like depression',
    confidence: 0.9,
  })
  assert.equal(profile.facts.length, 0)
})

test('contradicted keys are removed', () => {
  let profile = emptyProfile()
  profile = twice(profile, {
    category: 'situation',
    key: 'situation:stage',
    text: 'still together',
    confidence: 0.3,
  })
  profile = mergeExtractedFacts(profile, {
    contradictedKeys: ['situation:stage'],
    people: ['Jia Hui'],
  })
  assert.equal(profile.facts.some((f) => f.key === 'situation:stage'), false)
  assert.equal(profile.facts.some((f) => f.key === 'person:jia hui'), true)
})

test('facts need two hits before injection', () => {
  let profile = emptyProfile()
  profile = bumpFact(profile, {
    category: 'communication',
    key: 'write_length',
    text: 'You often write in short messages.',
    confidence: 0.5,
  })
  assert.equal(factsForInjection(profile).length, 0)
  profile = bumpFact(profile, {
    category: 'communication',
    key: 'write_length',
    text: 'You often write in short messages.',
    confidence: 0.5,
  })
  assert.equal(factsForInjection(profile).length, 1)
})

test('talk mode only injects style and rhythm, not situation', () => {
  let profile = emptyProfile()
  profile = twice(profile, {
    category: 'situation',
    key: 'person:alex',
    text: 'Someone you talk about as Alex.',
    confidence: 0.5,
  })
  profile = twice(profile, {
    category: 'communication',
    key: 'write_length',
    text: 'You often write in short messages.',
    confidence: 0.5,
  })
  const talk = factsForInjection(profile, { talkMode: true })
  assert.equal(talk.every((f) => f.category === 'communication' || f.category === 'rhythm'), true)
  assert.equal(talk.some((f) => f.category === 'situation'), false)
})

test('living profile block never names a profile system', () => {
  let profile = overlayPreferenceKnobs(emptyProfile(), {
    preferred_response_length: 'short',
    preferred_tone: 'warm',
    responds_well_to_questions: true,
    prefers_validation_over_advice: true,
  })
  const block = buildLivingProfileBlock(profile)
  assert.match(block, /PRIVATE ATTENTION/)
  assert.doesNotMatch(block, /your profile/i)
  assert.doesNotMatch(block, /I've learned/i)

  const lifted = buildLivingProfileBlock(profile, { liftLength: true })
  assert.match(lifted, /ignore short\/medium caps/)
})

test('public items and delete by id', () => {
  let profile = emptyProfile()
  profile = twice(profile, {
    category: 'situation',
    key: 'person:jia',
    text: 'Someone you talk about as Jia.',
    confidence: 0.4,
  })
  const groups = toPublicItems(profile)
  assert.equal(groups.length, 1)
  const id = groups[0].items[0].id
  profile = deleteFactById(profile, id)
  assert.equal(toPublicItems(profile).length, 0)
})

test('session summary and living payload use enc:v1 encryption', () => {
  const summary = 'They talked about Jia Hui and felt stuck after two weeks.'
  const cipher = encrypt(summary)
  assert.equal(cipher.startsWith(PREFIX), true)
  assert.equal(decrypt(cipher), summary)
  assert.equal(decrypt(summary), summary)

  const stored = serializeProfile(
    twice(emptyProfile(), {
      category: 'situation',
      key: 'person:jia hui',
      text: 'Someone you talk about as Jia Hui.',
      confidence: 0.4,
    }),
  )
  assert.equal(stored.startsWith(PREFIX), true)
  const loaded = deserializeProfile(stored)
  assert.equal(loaded.facts[0].text.includes('Jia Hui'), true)
})

test('personalisation off does not load a profile for injection', async () => {
  const profile = await getLivingProfileForUser('00000000-0000-4000-8000-000000000000', {
    personalisationEnabled: false,
  })
  assert.equal(profile, null)
})

test('guest completion messages do not include living profile', () => {
  const messages = buildChatCompletionMessages({
    modeId: 'cross',
    preferenceProfile: null,
    livingProfileBlock: '',
    conversationHistory: [],
    userText: 'i miss them',
  })
  const joined = messages.map((m) => m.content).join('\n')
  assert.doesNotMatch(joined, /PRIVATE ATTENTION/)
})

test('hidden think notes stay in a private block', () => {
  const block = buildThinkBlock('they want to feel believed, not fixed')
  assert.match(block, /PRIVATE THINK/)
  assert.match(block, /believed/)
})

test('late night rhythm is learned from hour', () => {
  let profile = emptyProfile()
  profile = mergeSessionSignals(profile, { user_avg_message_length: 40 }, 23)
  profile = mergeSessionSignals(profile, { user_avg_message_length: 40 }, 1)
  const rhythm = profile.facts.find((f) => f.key === 'rhythm:late_night')
  assert.ok(rhythm)
  assert.equal(rhythm.count, 2)
})

test('low-confidence pattern is not offered for naming', () => {
  let profile = emptyProfile()
  profile = bumpFact(profile, {
    category: 'pattern',
    key: 'pattern:repeat_loop',
    text: 'The same worry tends to come back in a conversation.',
    confidence: 0.2,
  })
  assert.equal(pickPatternToName(profile), undefined)
})
