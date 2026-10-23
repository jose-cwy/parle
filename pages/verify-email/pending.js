import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AuthPageShell from '../../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton, AuthSwitchLink } from '../../components/auth/AuthCard'

export default function VerifyPendingPage() {
  const router = useRouter()
  const queryEmail = typeof router.query.email === 'string' ? router.query.email : ''
  const mailFailed = router.query.mail === 'failed'
  const [email, setEmail] = useState(queryEmail)
  const [status, setStatus] = useState(mailFailed ? 'failed' : '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (queryEmail) setEmail(queryEmail)
  }, [queryEmail])

  useEffect(() => {
    let active = true
    fetch('/api/auth/verify-email/status', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!active || !payload?.email) return
        setEmail((current) => current || payload.email)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

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
      if (res.status === 429) {
        setStatus('wait')
      } else if (res.status === 503) {
        setStatus('failed')
      } else {
        setStatus('sent')
      }
    } catch {
      setStatus('failed')
    }
    setLoading(false)
  }

  const description = status === 'failed' || mailFailed
    ? 'We could not send the confirmation email yet. Stay here and request another link — your space was not opened.'
    : 'Confirm the address you used. Your space stays yours; it just is not fully open until the mailbox is proven.'

  const statusText = {
    wait: 'Please wait a minute before requesting another email.',
    failed: 'We could not send email right now. Try again in a little while.',
    sent: 'If that email can be confirmed, we sent a link.',
  }[status]

  return (
    <AuthPageShell>
      <AuthCard
        eyebrow="Almost there"
        title="Check your email"
        description={description}
        footer={(
          <>
            Used the wrong address? <AuthSwitchLink href="/register">Start again</AuthSwitchLink>
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
          <AuthSubmitButton loading={loading} disabled={loading}>
            Resend confirmation
          </AuthSubmitButton>
          {statusText ? <p className="auth-page__terms-hint" role="status">{statusText}</p> : null}
        </form>
      </AuthCard>
    </AuthPageShell>
  )
}
