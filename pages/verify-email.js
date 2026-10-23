import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AuthPageShell from '../components/auth/AuthPageShell'
import AuthCard, { AuthSubmitButton } from '../components/auth/AuthCard'
import { fetchAuthUser, setCachedAuthUser } from '../lib/authSession'
import { postLoginPath } from '../lib/routes'

export default function VerifyEmailPage() {
  const router = useRouter()
  const token = typeof router.query.token === 'string' ? router.query.token : ''
  const [status, setStatus] = useState(token ? 'ready' : 'missing')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) setStatus('ready')
  }, [token])

  async function confirm(event) {
    event.preventDefault()
    if (!token || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        const reason = payload?.reason || 'invalid'
        setStatus(reason)
        setError(
          reason === 'expired'
            ? 'This link has expired. Request a new one.'
            : reason === 'used'
              ? 'This link was already used.'
              : 'This confirmation link is not valid.',
        )
        return
      }
      if (payload?.user) setCachedAuthUser(payload.user)
      else await fetchAuthUser({ force: true })
      const user = payload?.user || (await fetchAuthUser({ force: true }))
      if (!user) {
        router.replace('/verify-email/pending')
        return
      }
      router.replace(postLoginPath(user))
    } catch {
      setStatus('invalid')
      setError('This confirmation link is not valid.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell>
      <AuthCard
        eyebrow="Confirm email"
        title={status === 'ready' ? 'Is this your space?' : 'We could not confirm that link'}
        description={
          status === 'ready'
            ? 'Email apps sometimes open links automatically. Press the button below to finish.'
            : error || 'Request a new confirmation email from the pending screen.'
        }
      >
        {status === 'ready' ? (
          <form onSubmit={confirm} className="auth-page__form">
            <AuthSubmitButton loading={loading}>Confirm my email</AuthSubmitButton>
          </form>
        ) : (
          <p className="auth-page__footer">
            <a className="auth-page__switchLink" href="/verify-email/pending">Request a new link</a>
          </p>
        )}
      </AuthCard>
    </AuthPageShell>
  )
}
