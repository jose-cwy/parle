/**
 * Client-visible crisis keyword filter for /api/chat/send.
 * TODO: Replace with a dedicated moderation service (e.g. OpenAI moderation API,
 * Perspective API, or a rules + classifier pipeline) before scaling production traffic.
 */

const SAFETY_KEYWORDS = [
  'suicide',
  'kill myself',
  'killing myself',
  'end my life',
  'want to die',
  'hurt myself',
  'self-harm',
  'self harm',
  'cut myself',
  'cutting myself',
  'overdose',
  'hang myself',
  'harm someone',
  'hurt someone',
]

export const CRISIS_SAFETY_REPLY =
  'I’m really sorry you’re going through this. Heartstrings Club cannot help in an emergency and is not a crisis service. If you are in immediate danger, please stop using the app and contact emergency services or someone you trust right now. In the U.S., call or text 988. Outside the U.S., use your local emergency number or crisis line.'

export function containsCrisisLanguage(text) {
  const t = String(text || '').toLowerCase()
  return SAFETY_KEYWORDS.some((keyword) => t.includes(keyword))
}
