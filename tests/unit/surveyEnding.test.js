const test = require('node:test')
const assert = require('node:assert/strict')
const { isSurveyConversationEnding } = require('../../lib/parle/surveyEnding')

test('survey ending requires a real close, not venting', () => {
  assert.equal(isSurveyConversationEnding("anyway that's all i needed to say. i think i'm good for now."), true)
  assert.equal(isSurveyConversationEnding("that's enough for today"), true)
  assert.equal(isSurveyConversationEnding("don't fix it. i just needed to scream into the void."), false)
  assert.equal(isSurveyConversationEnding('just listen i hate that they get to be happy'), false)
  assert.equal(isSurveyConversationEnding('what should i do next?'), false)
})
