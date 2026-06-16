import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import AuthPageShell from '../components/auth/AuthPageShell'
import AuthCard, { AuthField, AuthSubmitButton, AuthSwitchLink } from '../components/auth/AuthCard'
import TermsAgreementModal from '../components/TermsAgreementModal'
import { useTopProgress } from '../lib/hooks/useTopProgress'
import { TERMS_VERSION } from '../lib/termsVersion'

export default function Register({ acceptedTermsInitially }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptingTerms, setAcceptingTerms] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(acceptedTermsInitially)
  const router = useRouter()

  useTopProgress(loading || acceptingTerms)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!acceptedTerms) return

    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) router.push('/welcome')
    else {
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
      try {
        localStorage.setItem(
          'hs_safety_agreement_accepted',
          JSON.stringify({ version: TERMS_VERSION, at: new Date().toISOString() }),
        )
      } catch {
        /* cookie + DB on register are authoritative */
      }
      setAcceptedTerms(true)
      setAcceptingTerms(false)
      return
    }

    setAcceptingTerms(false)
    alert('Unable to record your acceptance right now. Please try again.')
  }

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
        {!acceptedTerms ? (
          <TermsAgreementModal
            accepting={acceptingTerms}
            onAccept={handleAcceptTerms}
          />
        ) : null}
      </AnimatePresence>
    </AuthPageShell>
  )
}

export async function getServerSideProps({ req }) {
  const { getTermsAcceptanceFromReq } = await import('../lib/auth')
  const acceptedTermsInitially = Boolean(getTermsAcceptanceFromReq(req))
  return { props: { acceptedTermsInitially } }
}
