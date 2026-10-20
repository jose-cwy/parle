/** 36 synthetic Phase 2 scenarios. No real user text. */
const SCENARIOS = [
  // Cross
  {
    id: 'cross-thin-miss',
    modeId: 'cross',
    userText: 'i miss them',
    history: [],
    expect: { comfortFirst: true, noUnsolicitedAdvice: true, noCopeQuestion: true },
  },
  {
    id: 'cross-fight-dump',
    modeId: 'cross',
    userText:
      'we got into a fight. she keeps clubbing after she said she would change. she asked for space and we have not texted in four days. yesterday she was out drinking and i found out from a story.',
    history: [],
    expect: { comfortFirst: true, noCopeQuestion: true, noMindRead: true },
  },
  {
    id: 'cross-analyze',
    modeId: 'cross',
    userText: 'can you actually analyze this. did she ever mean the space thing or was she already done.',
    history: [
      { role: 'user', text: 'she asked for space after a huge fight about clubbing' },
      { role: 'assistant', text: 'space after a fight about clubbing. that is a lot to sit with.' },
    ],
    expect: { mayAdvise: true, noMindRead: true },
  },
  {
    id: 'cross-skip-story-plan',
    modeId: 'cross',
    userText: "just tell me what to do after a breakup, i don't want to talk about what happened",
    history: [],
    expect: { mayAdvise: true, noForceStory: true },
  },
  {
    id: 'cross-cant',
    modeId: 'cross',
    userText: "i can't",
    history: [
      { role: 'user', text: 'four days of silence and she was out drinking' },
      { role: 'assistant', text: 'have you found any small moments of relief or distraction?' },
    ],
    expect: { noCopeQuestion: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'cross-done-talking',
    modeId: 'cross',
    userText: "anyway that's all i needed to say. i think i'm good for now.",
    history: [
      { role: 'user', text: 'we fought and she asked for space' },
      { role: 'assistant', text: 'that fight and the space request both landed at once.' },
    ],
    expect: { noForcedQuestion: true, noUnsolicitedAdvice: true },
  },
  // Emotional
  {
    id: 'emotional-bus',
    modeId: 'emotional',
    userText: 'i cried on the bus home and now i feel embarrassed like i should be over this already.',
    history: [],
    expect: { comfortFirst: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'emotional-kitchen',
    modeId: 'emotional',
    userText: 'nothing even happened today. i just miss them and it hit me in the kitchen.',
    history: [],
    expect: { comfortFirst: true, noInventPlot: true },
  },
  {
    id: 'emotional-friends-tired',
    modeId: 'emotional',
    userText: "everyone's tired of me talking about it. i don't want to dump this on my friends again.",
    history: [],
    expect: { comfortFirst: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'emotional-spiral',
    modeId: 'emotional',
    userText: "i'm spiraling and i can't stop crying",
    history: [],
    expect: { comfortFirst: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'emotional-held-callback',
    modeId: 'emotional',
    userText: 'and then she posted stories like nothing happened. i still have not heard from her.',
    history: [
      { role: 'user', text: 'i feel so miserable. we fought and she asked for space.' },
      { role: 'assistant', text: 'miserable after that fight and the space request. that is a lot.' },
      { role: 'user', text: 'she went clubbing last night' },
      { role: 'assistant', text: 'clubbing after asking for space does not match.' },
    ],
    expect: { comfortFirst: true },
  },
  {
    id: 'emotional-closing',
    modeId: 'emotional',
    userText: 'ok i think i just needed to hear that. i will try to sleep.',
    history: [
      { role: 'user', text: 'i cried on the bus' },
      { role: 'assistant', text: 'crying on the bus does not make you embarrassing.' },
    ],
    expect: { noForcedQuestion: true, noUnsolicitedAdvice: true },
  },
  // Logical
  {
    id: 'logical-still-care',
    modeId: 'logical',
    userText: 'they said they still care about me. that has to mean they are coming back, right?',
    history: [],
    expect: { noMindRead: true, mayAdvise: true },
  },
  {
    id: 'logical-show-up',
    modeId: 'logical',
    userText: 'i think if i just show up at their place and talk it out in person they will remember why we worked.',
    history: [],
    expect: { noMindRead: true, mayAdvise: true },
  },
  {
    id: 'logical-self-blame',
    modeId: 'logical',
    userText: "if i'd just been less anxious none of this would have happened. this is my fault.",
    history: [],
    expect: { noMindRead: true },
  },
  {
    id: 'logical-analyze-no-assume',
    modeId: 'logical',
    userText: 'be honest. analyze whether they loved me or i was convenient. we dated a year and they still cooked for me sometimes.',
    history: [],
    expect: { noMindRead: true, mayAdvise: true },
  },
  {
    id: 'logical-what-should-i-do',
    modeId: 'logical',
    userText: 'what should i do this week. i keep wanting to text.',
    history: [
      { role: 'user', text: 'we broke up two weeks ago after she asked for space' },
      { role: 'assistant', text: 'two weeks is still very fresh.' },
    ],
    expect: { mayAdvise: true, noMindRead: true },
  },
  {
    id: 'logical-unknown-motive',
    modeId: 'logical',
    userText: 'they went quiet after the weekend. i do not know why.',
    history: [],
    expect: { noMindRead: true },
  },
  // Vent
  {
    id: 'vent-hate-happy',
    modeId: 'vent',
    userText: 'i hate that they get to be happy like nothing happened. i did everything and they just walked.',
    history: [],
    expect: { noQuestions: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'vent-instagram',
    modeId: 'vent',
    userText: "they're acting single on instagram and all our friends are still liking their posts. i'm actually fuming.",
    history: [],
    expect: { noQuestions: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'vent-left-on-read',
    modeId: 'vent',
    userText: "and another thing they used to leave me on read for hours and i'd make excuses and i'm so done being the one who waited.",
    history: [],
    expect: { noQuestions: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'vent-stacked',
    modeId: 'vent',
    userText: 'plus they used our song on a story. like seriously.',
    history: [
      { role: 'user', text: 'i did everything and they just walked' },
      { role: 'assistant', text: 'you did everything and they walked.' },
    ],
    expect: { noQuestions: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'vent-done',
    modeId: 'vent',
    userText: 'anyway. i said it.',
    history: [
      { role: 'user', text: "i'm actually fuming" },
      { role: 'assistant', text: "yeah i'd be fuming too." },
    ],
    expect: { noQuestions: true, noForcedQuestion: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'vent-no-fix',
    modeId: 'vent',
    userText: "don't fix it. i just needed to scream into the void.",
    history: [],
    expect: { noQuestions: true, noUnsolicitedAdvice: true },
  },
  // Stop contact
  {
    id: 'stop-paragraph',
    modeId: 'stop_contact',
    userText: 'i have a paragraph typed. i just want to ask if they miss me. one text is not a big deal.',
    history: [],
    expect: { noUnsolicitedSend: true },
  },
  {
    id: 'stop-call',
    modeId: 'stop_contact',
    userText: "i'm this close to calling. i won't sleep if i don't hear their voice.",
    history: [],
    expect: { noUnsolicitedSend: true },
  },
  {
    id: 'stop-online',
    modeId: 'stop_contact',
    userText: 'i opened the chat. they were last active 4 minutes ago. if i send something now they will see it immediately.',
    history: [],
    expect: { noUnsolicitedSend: true },
  },
  {
    id: 'stop-charger',
    modeId: 'stop_contact',
    userText: 'i was gonna text them about the charger they still have. that is practical not emotional.',
    history: [],
    expect: { noUnsolicitedSend: true },
  },
  {
    id: 'stop-already-sent',
    modeId: 'stop_contact',
    userText: 'ok i already sent it. now i feel sick.',
    history: [
      { role: 'user', text: 'i have a paragraph typed' },
      { role: 'assistant', text: 'one text always feels small when it is sitting there typed.' },
    ],
    expect: { comfortFirst: true, noUnsolicitedSend: true },
  },
  {
    id: 'stop-held',
    modeId: 'stop_contact',
    userText: 'fine. i deleted the draft. i still want to though.',
    history: [
      { role: 'user', text: 'i have a paragraph typed asking if they miss me' },
      { role: 'assistant', text: 'what are you hoping that text actually gets you?' },
    ],
    expect: { noUnsolicitedSend: true },
  },
  // Talk
  {
    id: 'talk-movie',
    modeId: 'talk',
    userText: 'i just watched meet joe black and i just wanna talk about it',
    history: [],
    expect: { noTherapy: true },
  },
  {
    id: 'talk-leave-them-out',
    modeId: 'talk',
    userText: "can we not talk about them. i just don't want to sit in silence.",
    history: [],
    expect: { noTherapy: true, noUnsolicitedAdvice: true },
  },
  {
    id: 'talk-playlist',
    modeId: 'talk',
    userText: "couldn't sleep. put on a playlist we used to share by accident. now i feel weird but i don't want to unpack it.",
    history: [],
    expect: { noTherapy: true },
  },
  {
    id: 'talk-no-topic',
    modeId: 'talk',
    userText: "i don't even know what to say. i just didn't want to be alone in my head.",
    history: [],
    expect: { noTherapy: true },
  },
  {
    id: 'talk-short',
    modeId: 'talk',
    userText: 'hey',
    history: [],
    expect: { noTherapy: true },
  },
  {
    id: 'talk-analyze-film',
    modeId: 'talk',
    userText: 'okay analyze the ending of meet joe black for me without turning it into therapy',
    history: [
      { role: 'user', text: 'i just watched meet joe black' },
      { role: 'assistant', text: 'meet joe black stays with you.' },
    ],
    expect: { noTherapy: true, mayAdvise: true },
  },
]

const THINK_COMPARE_IDS = [
  'cross-fight-dump',
  'cross-thin-miss',
  'emotional-spiral',
  'logical-unknown-motive',
  'vent-hate-happy',
  'vent-no-fix',
  'stop-paragraph',
  'talk-leave-them-out',
  'cross-analyze',
  'logical-analyze-no-assume',
  'emotional-bus',
  'cross-done-talking',
]

module.exports = { SCENARIOS, THINK_COMPARE_IDS }
