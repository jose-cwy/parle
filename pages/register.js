import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import AuthPageShell from '../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton, AuthSwitchLink } from '../components/auth/AuthCard'
import TermsAgreementModal from '../components/TermsAgreementModal'
import { useTopProgress } from '../lib/hooks/useTopProgress'
import { TERMS_VERSION } from '../lib/termsVersion'
import { fetchAuthUser, setCachedAuthUser } from '../lib/authSession'
import { hasPreferredName } from '../lib/user'

const REGISTER_TERMS_SESSION_KEY = 'parle_register_terms_ok'

function hasAcceptedTermsThisSession() {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(REGISTER_TERMS_SESSION_KEY) === TERMS_VERSION
  } catch {
    return false
  }
}

function markTermsAcceptedThisSession() {
  try {
    sessionStorage.setItem(REGISTER_TERMS_SESSION_KEY, TERMS_VERSION)
  } catch {
    /* ignore */
  }
}

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptingTerms, setAcceptingTerms] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const router = useRouter()

  useTopProgress(loading || acceptingTerms || redirecting)

  useEffect(() => {
    let active = true

    async function init() {
      try {
        const user = await fetchAuthUser({ force: true })
        if (!active) return
        if (user) {
          setRedirecting(true)
          router.replace(hasPreferredName(user) ? '/dashboard' : '/welcome')
          return
        }

        if (hasAcceptedTermsThisSession()) {
          const termsRes = await fetch('/api/auth/terms-status', { credentials: 'same-origin' })
          const termsPayload = termsRes.ok ? await termsRes.json().catch(() => null) : null
          if (!active) return
          if (termsPayload?.accepted) {
            setAcceptedTerms(true)
          }
        }
      } catch {
        if (active) setAcceptedTerms(false)
      }
    }

    void init()
    return () => {
      active = false
    }
  }, [router])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!acceptedTerms) return

    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) {
      const payload = await res.json().catch(() => null)
      if (payload?.user) setCachedAuthUser(payload.user)
      router.replace('/welcome')
    } else {
      const payload = await res.json().catch(() => null)
      alert(payload?.error || 'Registration failed')
    }
    setLoading(false)
  }

  async function handleAcceptTerms() {
    if (acceptingTerms) return

    setAcceptingTerms(true)
    const res = await fetch('/api/auth/terms-accept', { method: 'POST' })

    if (res.ok) {
      markTermsAcceptedThisSession()
      try {
        localStorage.setItem(
          'hs_safety_agreement_accepted',
          JSON.stringify({ version: TERMS_VERSION, at: new Date().toISOString() }),
        )
      } catch {
        /* cookie is authoritative */
      }
      setAcceptedTerms(true)
      setAcceptingTerms(false)
      return
    }

    setAcceptingTerms(false)
    alert('Unable to record your acceptance right now. Please try again.')
  }

  if (redirecting) return null

  const showTermsModal = !acceptedTerms

  return (
    <AuthPageShell>
      <AuthCard
        eyebrow="Start gently"
        title="Sign up"
        description={
          acceptedTerms
            ? 'Create a quiet place for your thoughts.'
            : 'Read and accept the safety agreement to unlock signup.'
        }
        dimmed={!acceptedTerms}
        footer={
          <>
            Already have a space? <AuthSwitchLink href="/login">Log in</AuthSwitchLink>
          </>
        }
      >
        <form
          onSubmit={handleSubmit}
          className={`auth-page__form${acceptedTerms ? '' : ' auth-page__form--locked'}`}
        >
          <AuthField label="Email">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-page__input"
              type="email"
              autoComplete="email"
              required
              disabled={!acceptedTerms || loading || acceptingTerms}
            />
          </AuthField>
          <AuthField label="Password">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-page__input"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
              disabled={!acceptedTerms || loading || acceptingTerms}
            />
          </AuthField>
          {!acceptedTerms ? (
            <p className="auth-page__terms-hint" role="status">
              Please read and accept the Terms &amp; Safety Agreement before continuing.
            </p>
          ) : null}
          <AuthSubmitButton
            loading={loading || acceptingTerms}
            disabled={!acceptedTerms}
          >
            Create account
          </AuthSubmitButton>
        </form>
      </AuthCard>

      <AnimatePresence>
        {showTermsModal ? (
          <TermsAgreementModal
            key="register-terms"
            accepting={acceptingTerms}
            onAccept={handleAcceptTerms}
          />
        ) : null}
      </AnimatePresence>
    </AuthPageShell>
  )
}
