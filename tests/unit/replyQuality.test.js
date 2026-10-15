const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { BASE_SYSTEM_PROMPT, MODE_PROMPTS } = require('../../lib/parle/prompts')
const { buildChatCompletionMessages } = require('../../lib/parle/chatComplete')
const { buildThinkBlock } = require('../../lib/parle/hiddenThink')
const {
  wantsAnalysis,
  isThinSituation,
  shouldAskPersonName,
  hasKnownPersonName,
  getReplyQualitySignals,
  buildReplyQualityBlock,
} = require('../../lib/parle/replyQuality')

test('stream helper does not clamp the final streamed reply', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../lib/parle/chatStreamResponse.js'),
    'utf8',
  )
  assert.doesNotMatch(src, /sentenceClamp/)
})

test('analysis asks lift length in quality block', () => {
  assert.equal(wantsAnalysis('can you analyze my situation'), true)
  const signals = getReplyQualitySignals({
    userText: 'please break this down for me',
    history: [],
  })
  assert.equal(signals.liftLength, true)
  const block = buildReplyQualityBlock(signals)
  assert.match(block, /Lift short-reply caps/)
})

test('thin miss-them does not invent a plot', () => {
  assert.equal(isThinSituation('i miss them'), true)
  assert.equal(isThinSituation('we got into a fight and she went clubbing'), false)
  const block = buildReplyQualityBlock(
    getReplyQualitySignals({ userText: 'i miss them', history: [] }),
  )
  assert.match(block, /Do not invent a breakup/)
  assert.doesNotMatch(block, /they don't prioritize/)
})

test('asks for a name once when she/he is used and no name is known', () => {
  assert.equal(
    shouldAskPersonName({
      userText: 'she told me she needed space',
      history: [],
    }),
    true,
  )
  const named = shouldAskPersonName({
    userText: 'her name is Jia Hui and she needed space',
    history: [],
  })
  assert.equal(named, false)
  assert.equal(
    hasKnownPersonName({
      userText: 'whatever',
      livingProfile: {
        facts: [{ category: 'situation', key: 'person:jia hui', text: 'Jia Hui', count: 2, confidence: 0.7 }],
      },
    }),
    true,
  )
  assert.equal(
    shouldAskPersonName({
      userText: 'she is out again',
      history: [{ role: 'assistant', text: "what's her name, if you're ok saying?" }],
    }),
    false,
  )
})

test('talk mode does not ask for a name unless they are talking about a person', () => {
  assert.equal(
    shouldAskPersonName({
      userText: 'i just watched a movie',
      history: [],
      modeId: 'talk',
    }),
    false,
  )
})

test('base prompt teaches no parrot, name ask, and thin-situation handling', () => {
  assert.match(BASE_SYSTEM_PROMPT, /i miss them/)
  assert.match(BASE_SYSTEM_PROMPT, /what's her name, if you're ok saying/)
  assert.match(BASE_SYSTEM_PROMPT, /that's not space/)
  assert.match(BASE_SYSTEM_PROMPT, /Never generate a long answer and then cut it down/)
  assert.match(MODE_PROMPTS.talk, /Mid-sentence "that's" is fine/)
})

test('quality injection is present for completions and think stays private', () => {
  const quality = buildReplyQualityBlock(
    getReplyQualitySignals({ userText: 'analyze this fight', history: [] }),
  )
  const messages = buildChatCompletionMessages({
    modeId: 'cross',
    hiddenInjections: [quality],
    conversationHistory: [],
    userText: 'analyze this fight',
  })
  const joined = messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n')
  assert.match(joined, /PRIVATE REPLY QUALITY/)
  assert.match(buildThinkBlock('lift_length: yes'), /PRIVATE THINK/)
  assert.match(buildThinkBlock('lift_length: yes'), /keep the full breakdown/)
})
