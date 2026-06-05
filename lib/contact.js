export const SUPPORT_EMAIL = 'support.parle@gmail.com'

export const FEEDBACK_EMAIL_SUBJECT = 'parlé feedback'

export const FEEDBACK_EMAIL_BODY = `Hi parlé team,

[Share your feedback, question, or issue here]

Thanks,`

/** Opens Gmail compose in the browser — reliable when OS mailto handlers are unset. */
export function getFeedbackComposeUrl() {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: SUPPORT_EMAIL,
    su: FEEDBACK_EMAIL_SUBJECT,
    body: FEEDBACK_EMAIL_BODY,
  })

  return `https://mail.google.com/mail/?${params.toString()}`
}

/** Desktop mail app fallback (may prompt OS app picker on Windows). */
export function getFeedbackMailto() {
  const params = new URLSearchParams({
    subject: FEEDBACK_EMAIL_SUBJECT,
    body: FEEDBACK_EMAIL_BODY,
  })

  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`
}

export function openFeedbackCompose() {
  window.open(getFeedbackComposeUrl(), '_blank', 'noopener,noreferrer')
}
