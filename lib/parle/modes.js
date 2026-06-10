const MODES = [
  {
    id: 'cross',
    label: 'Cross-Mode',
    style: 'cross',
    mood: null,
  },
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
  cross: "got it — i'll read the room.",
  emotional: "okay, i'm here with you.",
  logical: "okay, i'll be straight with you.",
  vent: 'got it. let it out.',
  stop_contact: null,
}

const MODE_COLORS = {
  cross: '#8e44ad',
  emotional: '#27ae60',
  logical: '#2980b9',
  vent: '#f1c40f',
  stop_contact: '#c0392b',
}

const STOP_CONTACT_OPENING =
  'Good call coming here first. What were you going to say to them?'

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
  cross: 'Cross-Mode',
  emotional: 'Emotional',
  logical: 'Logical',
  vent: 'Vent',
  stop_contact: 'Stop reaching out',
}

function getModeShortLabel(id) {
  const resolved = resolveModeId(id)
  return MODE_SHORT_LABELS[resolved] || getModeById(id).label
}

const ENTRY_CHIP_ORDER = ['cross', 'emotional', 'logical', 'vent', 'stop_contact']
const MODE_PILL_ORDER = ENTRY_CHIP_ORDER

function getEntryChipLabel(id) {
  return getModeById(id).label
}

function getEntryModes() {
  return ENTRY_CHIP_ORDER.map((id) => getModeById(id))
}

function getModePillClasses(id, { selected = false, compact = false, filled = false } = {}) {
  const resolved = resolveModeId(id)
  const classes = ['parle-mode-pill', `parle-mode-pill--${resolved}`]
  if (compact) classes.push('parle-mode-pill--compact')
  if (filled) classes.push('parle-mode-pill--filled')
  if (selected) classes.push('parle-mode-pill--selected')
  return classes.join(' ')
}

function getModeColor(id) {
  const resolved = resolveModeId(id)
  return MODE_COLORS[resolved] || MODE_COLORS.cross
}

function getAssistantBubbleClass(modeId) {
  const resolved = resolveModeId(modeId || 'cross')
  return `parle-chat-msg__bubble--${resolved}`
}

module.exports = {
  MODES,
  DEFAULT_MODE,
  LEGACY_MODE_ID_ALIASES,
  MODE_SWITCH_ACK,
  MODE_COLORS,
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
  getModeColor,
  getAssistantBubbleClass,
}
