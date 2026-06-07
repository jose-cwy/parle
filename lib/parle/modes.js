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

const MODE_SHORT_LABELS = {
  listen: 'Just listen',
  vent: 'Vent',
  comfort: 'Comfort',
  honest: 'Be honest',
  understand: 'Help me',
  dont_text: 'Stop me',
}

function getModeShortLabel(id) {
  return MODE_SHORT_LABELS[id] || getModeById(id).label
}

const ENTRY_CHIP_ORDER = ['listen', 'comfort', 'honest', 'vent', 'understand', 'dont_text']

const ENTRY_CHIP_LABELS = {
  understand: 'Help me understand',
  dont_text: 'Stop me from reaching out',
}

function getEntryChipLabel(id) {
  if (ENTRY_CHIP_LABELS[id]) return ENTRY_CHIP_LABELS[id]
  return getModeById(id).label
}

function getEntryModes() {
  return ENTRY_CHIP_ORDER.map((id) => getModeById(id))
}

module.exports = {
  MODES,
  DEFAULT_MODE,
  MODE_SWITCH_ACK,
  MODE_SHORT_LABELS,
  ENTRY_CHIP_ORDER,
  ENTRY_CHIP_LABELS,
  DONT_TEXT_OPENING,
  getModeById,
  getModeLabel,
  getModeShortLabel,
  getEntryChipLabel,
  getEntryModes,
}
