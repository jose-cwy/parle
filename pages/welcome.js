import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AuthPageShell from '../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton } from '../components/auth/AuthCard'
import { useTopProgress } from '../lib/hooks/useTopProgress'
import { fetchAuthUser, getCachedAuthUser, setCachedAuthUser } from '../lib/authSession'
import { hasPreferredName } from '../lib/user'

export default function Welcome() {
  const [preferredName, setPreferredName] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let active = true

    fetchAuthUser({ force: true })
      .then((user) => {
        if (!active) return
        if (!user) {
          router.replace('/login?next=/welcome')
          return
        }
        if (hasPreferredName(user)) {
          router.replace('/dashboard')
          return
        }
        setChecking(false)
      })
      .catch(() => {
        if (active) router.replace('/login?next=/welcome')
      })

    return () => {
      active = false
    }
  }, [router])

  useTopProgress(checking)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/auth/preferred-name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferred_name: preferredName }),
    })

    if (res.ok) {
      const payload = await res.json().catch(() => null)
      if (payload?.user) {
        setCachedAuthUser(payload.user)
      } else {
        await fetchAuthUser({ force: true })
      }
      router.push('/dashboard')
      return
    }

    const payload = await res.json().catch(() => null)
    alert(payload?.error || 'Unable to save your name right now.')
    setLoading(false)
  }

  if (checking) return null

  return (
    <AuthPageShell>
      <AuthCard
        eyebrow="Welcome"
        title="What should we call you?"
        description="Just for greeting you inside your space — nothing public."
        privacyNote="You can change this anytime later."
      >
        <form onSubmit={handleSubmit} className="auth-page__form">
          <AuthField label="Your name">
            <input
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              className="auth-page__input"
              type="text"
              autoComplete="nickname given-name"
              placeholder="e.g. Alex"
              maxLength={40}
              required
              autoFocus
              disabled={loading}
            />
          </AuthField>
          <AuthSubmitButton loading={loading}>Continue</AuthSubmitButton>
        </form>
      </AuthCard>
    </AuthPageShell>
  )
}
