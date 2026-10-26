import { useState } from 'react'
import AuthPageShell from '../../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton, AuthSwitchLink } from '../../components/auth/AuthCard'

export default function VerifyRequiredPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function resend(event) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setStatus('')
    try {
      const res = await fetch('/api/auth/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) setStatus('sent')
      else if (res.status === 429) setStatus('wait')
      else setStatus('failed')
    } catch {
      setStatus('failed')
    }
    setLoading(false)
  }

  const statusText = {
    wait: 'Please wait a minute before requesting another email.',
    failed: 'We could not send email right now. Try again in a little while.',
    sent: 'If that email can be confirmed, we sent a link.',
  }[status]

  return (
    <AuthPageShell>
      <AuthCard
        eyebrow="One more step"
        title="Confirm your email to keep using this space"
        description="The gentle period has ended. Your journal, chats, and memories are still here — they open again after this mailbox is confirmed."
        footer={(
          <>
            Can’t reach this inbox? <AuthSwitchLink href="/verify-email/recovery">Use a different email</AuthSwitchLink>
          </>
        )}
      >
        <form onSubmit={resend} className="auth-page__form">
          <AuthField label="Email on this space">
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
          <AuthSubmitButton loading={loading} disabled={loading}>
            Send confirmation
          </AuthSubmitButton>
          {statusText ? <p className="auth-page__terms-hint" role="status">{statusText}</p> : null}
        </form>
      </AuthCard>
    </AuthPageShell>
  )
}
