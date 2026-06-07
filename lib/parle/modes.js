const MODES = [
  {
    id: 'listen',
    label: 'Just listen',
    style: 'listen',
    mood: null,
  },
  {
    id: 'vent',
    label: 'I just need to vent',
    style: 'vent',
    mood: 'vent',
  },
  {
    id: 'comfort',
    label: 'Comfort me first',
    style: 'comfort',
    mood: null,
  },
  {
    id: 'honest',
    label: 'Be honest with me',
    style: 'honest',
    mood: null,
  },
  {
    id: 'understand',
    label: 'Help me understand what happened',
    style: 'understand',
    mood: 'understand',
  },
  {
    id: 'dont_text',
    label: 'Stop me from texting them',
    style: 'dont_text',
    mood: 'text',
  },
]

const DEFAULT_MODE = MODES[0]

const MODE_SWITCH_ACK = {
  listen: "Okay, I'll just be here with you.",
  vent: 'Got it. Let it out.',
  comfort: "Of course. You don't have to figure anything out right now.",
  honest: "Okay, I'll be more direct.",
  understand: "Let's slow down and look at this together.",
  dont_text: null,
}

const DONT_TEXT_OPENING =
  'Good call coming here first. What were you going to say to them?'

function getModeById(id) {
  return MODES.find((m) => m.id === id) || DEFAULT_MODE
}

function getModeLabel(id) {
  return getModeById(id).label
}

module.exports = {
  MODES,
  DEFAULT_MODE,
  MODE_SWITCH_ACK,
  DONT_TEXT_OPENING,
  getModeById,
  getModeLabel,
}
