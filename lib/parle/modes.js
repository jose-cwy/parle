const MODES = [
  {
    id: 'emotional',
    label: 'Emotional support',
    style: 'emotional',
    mood: null,
  },
  {
    id: 'logical',
    label: 'Be honest with me',
    style: 'logical',
    mood: null,
  },
  {
    id: 'vent',
    label: 'I just need to vent',
    style: 'vent',
    mood: 'vent',
  },
  {
    id: 'stop_contact',
    label: 'Stop me from reaching out',
    style: 'stop_contact',
    mood: 'text',
  },
]

const DEFAULT_MODE = MODES[0]

const LEGACY_MODE_ID_ALIASES = {
  listen: 'emotional',
  comfort: 'emotional',
  honest: 'logical',
  understand: 'logical',
  dont_text: 'stop_contact',
}

const MODE_SWITCH_ACK = {
  emotional: "okay, i'm here with you.",
  logical: "okay, i'll be straight with you.",
  vent: 'got it. let it out.',
  stop_contact: null,
}

const STOP_CONTACT_OPENING =
  'good call coming here first. what were you going to say to them?'

function resolveModeId(id) {
  return LEGACY_MODE_ID_ALIASES[id] || id
}

function getModeById(id) {
  const resolved = resolveModeId(id)
  return MODES.find((m) => m.id === resolved) || DEFAULT_MODE
}

function getModeLabel(id) {
  return getModeById(id).label
}

const MODE_SHORT_LABELS = {
  emotional: 'Emotional',
  logical: 'Honest',
  vent: 'Vent',
  stop_contact: 'Stop reaching out',
}

function getModeShortLabel(id) {
  const resolved = resolveModeId(id)
  return MODE_SHORT_LABELS[resolved] || getModeById(id).label
}

const ENTRY_CHIP_ORDER = ['emotional', 'logical', 'vent', 'stop_contact']
const MODE_PILL_ORDER = ENTRY_CHIP_ORDER

function getEntryChipLabel(id) {
  return getModeById(id).label
}

function getEntryModes() {
  return ENTRY_CHIP_ORDER.map((id) => getModeById(id))
}

function getModePillClasses(id, { selected = false, compact = false } = {}) {
  const resolved = resolveModeId(id)
  const classes = ['parle-mode-pill', `parle-mode-pill--${resolved}`]
  if (compact) classes.push('parle-mode-pill--compact')
  if (selected) classes.push('parle-mode-pill--selected')
  return classes.join(' ')
}

function getAssistantBubbleClass(modeId) {
  const resolved = resolveModeId(modeId || 'emotional')
  return `parle-chat-msg__bubble--${resolved}`
}

module.exports = {
  MODES,
  DEFAULT_MODE,
  LEGACY_MODE_ID_ALIASES,
  MODE_SWITCH_ACK,
  MODE_SHORT_LABELS,
  ENTRY_CHIP_ORDER,
  MODE_PILL_ORDER,
  STOP_CONTACT_OPENING,
  /** @deprecated use STOP_CONTACT_OPENING */
  DONT_TEXT_OPENING: STOP_CONTACT_OPENING,
  resolveModeId,
  getModeById,
  getModeLabel,
  getModeShortLabel,
  getEntryChipLabel,
  getEntryModes,
  getModePillClasses,
  getAssistantBubbleClass,
}
