import { clearGuestSessionToken } from './guestSessionToken'

/**
 * Wipe guest / shared browser chat leftovers so a newly authenticated session
 * never inherits guest transcripts, titles, or sidebar archives.
 */
const GUEST_STORAGE_KEYS = [
  'parle_session_token',
  'parle_guest_consent',
  'parle_guest_email',
  'parle_email_prompt_shown',
  'parle_onboarding_answered',
  'parle_onboarding_reason',
  'parle_product_pulse_shown',
  'parle_product_pulse_variant',
  'parle.chat.preferredMode.v1',
  'parle.chat.liveSessionMeta.v1',
  'parle.chat.archives.v1',
]

export function clearGuestChatState() {
  if (typeof window === 'undefined') return

  GUEST_STORAGE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  })

  clearGuestSessionToken()
}
