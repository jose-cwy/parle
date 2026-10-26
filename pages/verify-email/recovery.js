import { useState } from 'react'
import AuthPageShell from '../../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton, AuthSwitchLink } from '../../components/auth/AuthCard'
import { SUPPORT_EMAIL } from '../../lib/contact'

export default function VerifyRecoveryPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    setStatus('')
    try {
      const res = await fetch('/api/auth/verify-email/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      })
      const payload = await res.json().catch(() => null)
      if (res.status === 429) setError('Please wait a minute before trying again.')
      else if (res.status === 503) setError('We could not send email right now.')
      else if (!res.ok) setError(payload?.error || 'That did not work. Check the password and try again.')
      else setStatus('sent')
    } catch {
      setError('That did not work. Try again in a little while.')
    }
    setLoading(false)
  }

  return (
    <AuthPageShell>
      <AuthCard
        eyebrow="Still yours"
        title="Move this space to an email you can open"
        description="Your chats, journal, and memories stay on this account. We send a confirmation to the new address first. The login email only changes after you confirm it."
        footer={(
          <>
            Remembered the old inbox? <AuthSwitchLink href="/verify-email/pending">Send to that email instead</AuthSwitchLink>
          </>
        )}
        privacyNote={`If you no longer have the password either, write ${SUPPORT_EMAIL}. We will not delete your space to solve this.`}
      >
        <form onSubmit={submit} className="auth-page__form">
          {error ? <p className="auth-page__terms-hint" role="alert">{error}</p> : null}
          {status === 'sent' ? (
            <p className="auth-page__terms-hint" role="status">
              If that mailbox can receive mail, open the confirmation link to finish moving this space.
            </p>
          ) : null}
          <AuthField label="New email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-page__input"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
            />
          </AuthField>
          <AuthField label="Current password">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-page__input"
              type="password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </AuthField>
          <AuthSubmitButton loading={loading} disabled={loading}>
            Send to the new email
          </AuthSubmitButton>
        </form>
      </AuthCard>
    </AuthPageShell>
  )
}
