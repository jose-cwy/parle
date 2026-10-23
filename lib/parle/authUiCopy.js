export const AUTH_QUERY_MESSAGES = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_denied: 'Google sign-in was denied.',
  google_error: 'Google sign-in did not finish. Please try again.',
  google_other_account: 'That Google account is already connected to another space.',
  google_email_mismatch: 'That Google account uses a different email than this space.',
  link_required: 'A parlé space already uses this email. Log in with your password, confirm the email, then link Google in Settings.',
  verify_before_link: 'Confirm your email before linking Google.',
}

export function authQueryMessage(code) {
  return AUTH_QUERY_MESSAGES[String(code || '')] || null
}
