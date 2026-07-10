export const ONBOARDING_ANSWERED_KEY = 'parle_onboarding_answered'
export const ONBOARDING_REASON_KEY = 'parle_onboarding_reason'

export const ONBOARDING_OPTIONS = [
  { id: 'heartbreak', label: 'heartbreak or breakup' },
  { id: 'friendship_family', label: 'friendship or family' },
  { id: 'just_talking', label: 'just needed somewhere to talk' },
]

const VALID_REASONS = new Set([
  'heartbreak',
  'friendship_family',
  'just_talking',
  'skipped',
])

export function isValidOnboardingReason(reason) {
  return VALID_REASONS.has(reason)
}

export function isGuestOnboardingAnswered() {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(ONBOARDING_ANSWERED_KEY) === 'true'
  } catch {
    return true
  }
}

export function saveGuestOnboarding(reason) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ONBOARDING_ANSWERED_KEY, 'true')
    localStorage.setItem(ONBOARDING_REASON_KEY, String(reason || 'skipped'))
  } catch {
    /* ignore quota errors */
  }
}

export function getOnboardingContextInjection(reason) {
  switch (reason) {
    case 'heartbreak':
      return '[CONTEXT] This user came here because of a heartbreak or breakup. Factor this into your first response — be especially warm and present.'
    case 'friendship_family':
      return '[CONTEXT] This user came here because of a friendship or family situation, not a romantic breakup. Adjust your responses accordingly — do not assume romantic context.'
    case 'just_talking':
      return '[CONTEXT] This user just needed somewhere to talk. They may not be in acute pain. Be conversational and warm rather than immediately assuming crisis.'
    default:
      return null
  }
}
