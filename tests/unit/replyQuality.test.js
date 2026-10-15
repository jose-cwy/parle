const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { BASE_SYSTEM_PROMPT, MODE_PROMPTS } = require('../../lib/parle/prompts')
const { buildChatCompletionMessages } = require('../../lib/parle/chatComplete')
const { buildThinkBlock } = require('../../lib/parle/hiddenThink')
const {
  wantsAnalysis,
  wantsAdvice,
  isThinSituation,
  looksLikeRealName,
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
    getReplyQualitySignals({ userText: "i'm sad", history: [] }),
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

test('role labels are not treated as names', () => {
  assert.equal(looksLikeRealName('girlfriend'), false)
  assert.equal(looksLikeRealName('she'), false)
  assert.equal(looksLikeRealName('jia hui'), true)
  assert.equal(
    hasKnownPersonName({
      userText: 'whatever',
      livingProfile: {
        facts: [
          {
            category: 'situation',
            key: 'person:girlfriend',
            text: 'Someone you talk about as girlfriend.',
            count: 2,
            confidence: 0.7,
          },
        ],
      },
    }),
    false,
  )
})

test('name ask is required and still fires on a late first she', () => {
  const history = [
    { role: 'user', text: 'hey' },
    { role: 'assistant', text: 'hey. what is going on?' },
    { role: 'user', text: 'just a rough week' },
    { role: 'assistant', text: 'yeah. say more if you want.' },
    { role: 'user', text: 'work has been a lot' },
    { role: 'assistant', text: 'work on top of everything else is a lot.' },
    { role: 'user', text: 'and i have not been sleeping' },
    { role: 'assistant', text: 'that kind of tired sits in your body.' },
  ]
  assert.equal(
    shouldAskPersonName({
      userText: 'she told me she needed space',
      history,
    }),
    true,
  )
  const block = buildReplyQualityBlock(
    getReplyQualitySignals({
      userText: 'she told me she needed space',
      history,
    }),
  )
  assert.match(block, /MUST/)
  assert.match(block, /name ask/)
})

test('cross sits with the story until they ask for a take', () => {
  const story = getReplyQualitySignals({
    userText: 'we got into a fight and she went clubbing and now four days of silence',
    history: [],
    modeId: 'cross',
  })
  assert.equal(story.sitWithStory, true)
  assert.equal(story.wantsAdvice, false)
  const storyBlock = buildReplyQualityBlock(story)
  assert.match(storyBlock, /sit with the situation/)
  assert.match(storyBlock, /Do NOT ask what they are going to do next/)

  assert.equal(wantsAdvice('what should i do'), true)
  const asked = getReplyQualitySignals({
    userText: 'what do you think of this?',
    history: [],
    modeId: 'cross',
  })
  assert.equal(asked.sitWithStory, false)
  assert.equal(asked.wantsOpinion, true)
  const askedBlock = buildReplyQualityBlock(asked)
  assert.match(askedBlock, /You may take a position or give advice/)
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
  assert.match(BASE_SYSTEM_PROMPT, /you MUST ask/)
  assert.match(MODE_PROMPTS.cross, /Sit with the situation/)
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
