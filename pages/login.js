import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AuthPageShell from '../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton, AuthSwitchLink } from '../components/auth/AuthCard'
import { useTopProgress } from '../lib/hooks/useTopProgress'
import { fetchAuthUser } from '../lib/authSession'
import { safeNextPath } from '../lib/routes'
import { hasPreferredName } from '../lib/user'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let active = true

    fetchAuthUser({ force: true })
      .then((user) => {
        if (!active) return
        if (user) {
          const destination = !hasPreferredName(user)
            ? '/welcome'
            : safeNextPath(router.query.next)
          router.replace(destination)
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

    if (res.ok) {
      const authUser = await fetchAuthUser({ force: true })
      const destination = !hasPreferredName(authUser)
        ? '/welcome'
        : router.query.next
          ? safeNextPath(router.query.next)
          : '/dashboard'
      router.replace(destination)
    } else {
      const payload = await res.json().catch(() => null)
      alert(payload?.error || 'Login failed')
      setLoading(false)
    }
  }

  if (checking) return null

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
