const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { BASE_SYSTEM_PROMPT, MODE_PROMPTS } = require('../../lib/parle/prompts')
const { buildChatCompletionMessages } = require('../../lib/parle/chatComplete')
const { buildThinkBlock, THINK_PROMPT } = require('../../lib/parle/hiddenThink')
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
    false,
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

test('name ask waits until the 3rd person mention and stops after the 5th', () => {
  const turn1 = []
  assert.equal(
    shouldAskPersonName({ userText: 'she needed space', history: turn1 }),
    false,
  )
  const turn2 = [
    { role: 'user', text: 'she needed space' },
    { role: 'assistant', text: 'yeah.' },
  ]
  assert.equal(
    shouldAskPersonName({ userText: 'and she went clubbing', history: turn2 }),
    false,
  )
  const turn3 = [
    ...turn2,
    { role: 'user', text: 'and she went clubbing' },
    { role: 'assistant', text: 'that does not match space.' },
  ]
  assert.equal(
    shouldAskPersonName({ userText: 'still no text from her', history: turn3 }),
    true,
  )
  const block = buildReplyQualityBlock(
    getReplyQualitySignals({
      userText: 'still no text from her',
      history: turn3,
    }),
  )
  assert.match(block, /MUST/)
  assert.match(block, /name ask/)

  const many = []
  for (let i = 0; i < 5; i += 1) {
    many.push({ role: 'user', text: `she did another thing ${i}` })
    many.push({ role: 'assistant', text: 'ok' })
  }
  assert.equal(
    shouldAskPersonName({ userText: 'she posted again', history: many }),
    false,
  )
})

test('cross sits with the story until they ask for a take', () => {
  const story = getReplyQualitySignals({
    userText: 'we got into a fight and she went clubbing and now four days of silence',
    history: [],
    modeId: 'cross',
  })
  assert.equal(story.sitWithStory, true)
  assert.equal(story.storyPhase, 'gather')
  assert.equal(story.userTurnCount, 1)
  assert.equal(story.wantsAdvice, false)
  const storyBlock = buildReplyQualityBlock(story)
  assert.match(storyBlock, /MUST/)
  assert.match(storyBlock, /comfort\/understanding/)
  assert.match(storyBlock, /how do you cope with that sense of loss/)
  assert.match(storyBlock, /have you found any small moments of relief or distraction/)
  assert.match(storyBlock, /at most one situation question/)

  assert.equal(wantsAdvice('what should i do'), true)
  const asked = getReplyQualitySignals({
    userText: 'what do you think of this?',
    history: [],
    modeId: 'cross',
  })
  assert.equal(asked.sitWithStory, false)
  assert.equal(asked.storyPhase, 'plan_without_story')
  assert.equal(asked.wantsOpinion, true)
  const askedBlock = buildReplyQualityBlock(asked)
  assert.match(askedBlock, /do not want to share the story|Help with what to do/i)
})

test('story phases: gather, held, skip-story, distressed, i can\'t', () => {
  const miserable = getReplyQualitySignals({
    userText: 'i feel miserable',
    history: [],
    modeId: 'cross',
  })
  assert.equal(miserable.storyPhase, 'gather')
  const miserableBlock = buildReplyQualityBlock(miserable)
  assert.match(miserableBlock, /comfort\/understanding/)
  assert.match(miserableBlock, /how do you cope with that sense of loss/)

  const firstDump = getReplyQualitySignals({
    userText: 'we got into a fight and she went clubbing and now four days of silence',
    history: [],
    modeId: 'cross',
  })
  assert.equal(firstDump.storyPhase, 'gather')
  assert.equal(firstDump.storyHeld, false)

  const held = getReplyQualitySignals({
    userText: 'and then she posted stories like nothing happened',
    history: [
      { role: 'user', text: 'we got into a fight and she went clubbing' },
      { role: 'assistant', text: 'how did you find out she was out?' },
    ],
    modeId: 'cross',
  })
  assert.equal(held.storyPhase, 'held')
  assert.equal(held.storyHeld, true)
  const heldBlock = buildReplyQualityBlock(held)
  assert.match(heldBlock, /enough of the situation/)
  assert.match(heldBlock, /callback/)
  assert.doesNotMatch(heldBlock, /gather the situation/)

  const skip = getReplyQualitySignals({
    userText: "just tell me what to do after a breakup, i don't want to talk about what happened",
    history: [],
    modeId: 'cross',
  })
  assert.equal(skip.storyPhase, 'plan_without_story')
  assert.equal(skip.planWithoutStory, true)
  const skipBlock = buildReplyQualityBlock(skip)
  assert.match(skipBlock, /Do not force what happened/)

  const distressed = getReplyQualitySignals({
    userText: "i'm spiraling and i can't stop crying",
    history: [],
    modeId: 'cross',
  })
  assert.equal(distressed.storyPhase, 'gather')
  assert.equal(distressed.distressed, true)
  const distressedBlock = buildReplyQualityBlock(distressed)
  assert.match(distressedBlock, /very distressed/)
  assert.match(distressedBlock, /ask about the situation/)

  const refused = getReplyQualitySignals({
    userText: "i can't",
    history: [{ role: 'assistant', text: 'how do you cope with that sense of loss?' }],
    modeId: 'cross',
  })
  assert.equal(refused.rejectedNextSteps, true)
  assert.equal(refused.storyPhase, 'gather')
  const refusedBlock = buildReplyQualityBlock(refused)
  assert.match(refusedBlock, /MUST/)
  assert.match(refusedBlock, /Drop that thread/)
  assert.match(refusedBlock, /Ask about the situation instead/)

  const notRefusal = getReplyQualitySignals({
    userText: "i know it's pathetic i just can't stop",
    history: [],
    modeId: 'cross',
  })
  assert.equal(notRefusal.rejectedNextSteps, false)
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
  assert.match(BASE_SYSTEM_PROMPT, /that's not the version of space she described/)
  assert.match(BASE_SYSTEM_PROMPT, /Never generate a long answer and then cut it down/)
  assert.match(BASE_SYSTEM_PROMPT, /you MUST ask/)
  assert.match(BASE_SYSTEM_PROMPT, /Do not ask for a name on the first/)
  assert.match(MODE_PROMPTS.cross, /Comfort and understanding first/)
  assert.match(MODE_PROMPTS.talk, /Mid-sentence "that's" is fine/)
  assert.match(BASE_SYSTEM_PROMPT, /User: "i can't"/)
  assert.match(BASE_SYSTEM_PROMPT, /how do you cope with that sense of loss/)
  assert.match(BASE_SYSTEM_PROMPT, /have you found any small moments of relief or distraction/)
  assert.match(BASE_SYSTEM_PROMPT, /that mix of warmth and sadness can be so intense/)
  assert.match(BASE_SYSTEM_PROMPT, /just tell me what to do after a breakup/)
  assert.match(BASE_SYSTEM_PROMPT, /you said earlier you were miserable/)
  assert.match(BASE_SYSTEM_PROMPT, /how did you find out she was out/)
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
  assert.match(THINK_PROMPT, /story_phase: gather/)
  assert.match(THINK_PROMPT, /comfort first/)
  assert.match(THINK_PROMPT, /plan_without_story/)
})

test('vent mode ignores gather and name-ask', () => {
  const vent = getReplyQualitySignals({
    userText: 'we got into a fight and she went clubbing and now four days of silence',
    history: [],
    modeId: 'vent',
  })
  assert.equal(vent.sitWithStory, false)
  assert.equal(vent.storyPhase, 'vent')
  const block = buildReplyQualityBlock(vent)
  assert.match(block, /Zero questions/)
  assert.match(block, /question marks/)
  assert.doesNotMatch(block, /comfort\/understanding in the first line/)
  assert.equal(
    shouldAskPersonName({
      userText: 'still no text from her',
      history: [
        { role: 'user', text: 'she needed space' },
        { role: 'assistant', text: 'yeah.' },
        { role: 'user', text: 'and she went clubbing' },
        { role: 'assistant', text: 'that does not match space.' },
      ],
      modeId: 'vent',
    }),
    false,
  )
})

test('closed turn skips the interview', () => {
  const closed = getReplyQualitySignals({
    userText: "anyway that's all i needed to say. i think i'm good for now.",
    history: [{ role: 'user', text: 'we fought' }, { role: 'assistant', text: 'yeah.' }],
    modeId: 'cross',
  })
  assert.equal(closed.storyPhase, 'close')
  assert.equal(closed.closedTurn, true)
  const block = buildReplyQualityBlock(closed)
  assert.match(block, /closed the turn/)
  assert.doesNotMatch(block, /at most one situation question/)
})

test('logical quality forbids invented inner life', () => {
  const logical = getReplyQualitySignals({
    userText: 'did they ever actually love me',
    history: [],
    modeId: 'logical',
  })
  const block = buildReplyQualityBlock(logical)
  assert.match(block, /do not invent the other person's intentions/)
  assert.match(block, /At most one question/)
})

test('cross analysis quality forbids invented motives', () => {
  const block = buildReplyQualityBlock(
    getReplyQualitySignals({
      userText: 'can you actually analyze this. did she ever mean the space thing',
      history: [],
      modeId: 'cross',
    }),
  )
  assert.match(block, /analysis stays with facts/)
  assert.match(block, /what you do not know/)
  assert.match(MODE_PROMPTS.cross, /do not invent motives/i)
})
