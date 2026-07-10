const ONBOARDING_REASON_KEY = 'parle_onboarding_reason'

export const GUEST_EMAIL_KEY = 'parle_guest_email'
export const EMAIL_PROMPT_SHOWN_KEY = 'parle_email_prompt_shown'

export const GUEST_EMAIL_THRESHOLD_DESKTOP = 8
export const GUEST_EMAIL_THRESHOLD_MOBILE = 5

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidGuestEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  if (!value || value.length > 320) return false
  return EMAIL_PATTERN.test(value)
}

export function hasGuestEmail() {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(localStorage.getItem(GUEST_EMAIL_KEY))
  } catch {
    return false
  }
}

export function getGuestEmail() {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(GUEST_EMAIL_KEY)
  } catch {
    return null
  }
}

export function saveGuestEmail(email) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GUEST_EMAIL_KEY, String(email || '').trim().toLowerCase())
  } catch {
    /* ignore quota errors */
  }
}

export function wasEmailPromptShownThisSession() {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(EMAIL_PROMPT_SHOWN_KEY) === 'true'
  } catch {
    return false
  }
}

export function markEmailPromptShownThisSession() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(EMAIL_PROMPT_SHOWN_KEY, 'true')
  } catch {
    /* ignore quota errors */
  }
}

export function isMobileGuestEmailViewport() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px)').matches
}

export function getGuestEmailThreshold() {
  return isMobileGuestEmailViewport()
    ? GUEST_EMAIL_THRESHOLD_MOBILE
    : GUEST_EMAIL_THRESHOLD_DESKTOP
}

export function shouldOfferBeforeunloadEmailPrompt(userMessageCount) {
  const count = Number(userMessageCount) || 0
  if (count <= 0) return false
  return count < getGuestEmailThreshold()
}

export function getGuestOnboardingReasonForEmail() {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(ONBOARDING_REASON_KEY) || null
  } catch {
    return null
  }
}
