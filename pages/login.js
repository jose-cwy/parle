import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AuthPageShell from '../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton, AuthSwitchLink } from '../components/auth/AuthCard'
import ContinueWithGoogle from '../components/auth/ContinueWithGoogle'
import { useTopProgress } from '../lib/hooks/useTopProgress'
import { fetchAuthUser } from '../lib/authSession'
import { clearGuestChatState } from '../lib/parle/clearGuestChatState'
import { postLoginPath } from '../lib/routes'
import { authQueryMessage } from '../lib/parle/authUiCopy'

const googleSignInPublic = process.env.NEXT_PUBLIC_PARLE_GOOGLE_SIGNIN !== 'false'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const queryError = authQueryMessage(router.query.auth)

  useEffect(() => {
    let active = true

    fetchAuthUser({ force: true })
      .then((user) => {
        if (!active) return
        if (user) {
          router.replace(postLoginPath(user, router.query.next))
          return
        }
        setChecking(false)
      })
      .catch(() => {
        if (active) setChecking(false)
      })

    return () => {
      active = false
    }
  }, [router])

  useTopProgress(loading || checking)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const payload = await res.json().catch(() => null)
    if (res.ok) {
      clearGuestChatState()
      const authUser = await fetchAuthUser({ force: true })
      router.replace(postLoginPath(authUser, router.query.next))
      return
    }
    if (res.status === 403 && payload?.pending) {
      router.replace('/verify-email/pending')
      return
    }
    setError(payload?.error || 'Login failed')
    setLoading(false)
  }

  if (checking) {
    return (
      <AuthPageShell>
        <AuthCard
          eyebrow="Welcome back"
          title="Log in"
          description="Opening your space…"
        />
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <AuthCard
        eyebrow="Welcome back"
        title="Log in"
        description="Continue where you left your thoughts."
        footer={
          <>
            New here? <AuthSwitchLink href="/register">Create your space</AuthSwitchLink>
          </>
        }
      >
        {(error || queryError) ? (
          <p className="auth-page__terms-hint" role="alert">{error || queryError}</p>
        ) : null}
        {googleSignInPublic ? (
          <>
            <ContinueWithGoogle href={`/api/auth/google/start?next=${encodeURIComponent(String(router.query.next || ''))}`} disabled={loading} />
            <p className="auth-page__divider" role="separator">or</p>
          </>
        ) : null}
        <form onSubmit={handleSubmit} className="auth-page__form">
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
          <AuthField label="Password">
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
          <AuthSubmitButton loading={loading}>Log in</AuthSubmitButton>
        </form>
      </AuthCard>
    </AuthPageShell>
  )
}
