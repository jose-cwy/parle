import { useState } from 'react'
import AuthPageShell from '../../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton, AuthSwitchLink } from '../../components/auth/AuthCard'

export default function VerifyPendingPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function resend(event) {
    event.preventDefault()
    setLoading(true)
    setStatus('')
    const res = await fetch('/api/auth/verify-email/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.status === 429) {
      setStatus('Please wait a minute before requesting another email.')
    } else if (res.status === 503) {
      setStatus('We could not send email right now. Try again in a little while.')
    } else {
      setStatus('If that email can be confirmed, we sent a link.')
    }
    setLoading(false)
  }

  return (
    <AuthPageShell>
      <AuthCard
        eyebrow="Almost there"
        title="Check your email"
        description="Confirm the address you used. Your space stays yours; it just is not fully open until the mailbox is proven."
        footer={(
          <>
            Already confirmed? <AuthSwitchLink href="/login">Log in</AuthSwitchLink>
          </>
        )}
      >
        <form onSubmit={resend} className="auth-page__form">
          <AuthField label="Email">
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
          <AuthSubmitButton loading={loading}>Resend confirmation</AuthSubmitButton>
          {status ? <p className="auth-page__terms-hint" role="status">{status}</p> : null}
        </form>
      </AuthCard>
    </AuthPageShell>
  )
}
