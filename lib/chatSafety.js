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
  'want to disappear',
  "don't want to be here",
  'dont want to be here',
  'do not want to be here',
  'not want to be here anymore',
  'hurt myself',
  'hurting myself',
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
  "Hey — what you're going through sounds really heavy, and you deserve real support right now. SOS: 1-767 | IMH: 6389 2222 | Chat: chat.mentalhealth.sg. Want to keep talking here, or would reaching out to one of those feel better?"

export function containsCrisisLanguage(text) {
  const t = String(text || '').toLowerCase()
  return SAFETY_KEYWORDS.some((keyword) => t.includes(keyword))
}
