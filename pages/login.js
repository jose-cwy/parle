import { useState } from 'react'
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
  const router = useRouter()

  useTopProgress(loading)

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
      router.push(destination)
    } else {
      const payload = await res.json().catch(() => null)
      alert(payload?.error || 'Login failed')
      setLoading(false)
    }
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
        <form onSubmit={handleSubmit} className="auth-page__form">
          <AuthField label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-page__input"
              type="email"
              autoComplete="email"
              required
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
            />
          </AuthField>
          <AuthSubmitButton loading={loading}>Log in</AuthSubmitButton>
        </form>
      </AuthCard>
    </AuthPageShell>
  )
}

export async function getServerSideProps({ req, query }) {
  const { getSessionPayload } = await import('../lib/auth')
  if (getSessionPayload(req)) {
    return {
      redirect: {
        destination: safeNextPath(query.next),
        permanent: false,
      },
    }
  }

  return { props: {} }
}
