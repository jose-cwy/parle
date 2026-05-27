import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/router'
import AnimatedCard from '../components/AnimatedCard'
import Reveal from '../components/Reveal'
import SkeletonBlock, { SkeletonButton } from '../components/Skeleton'
import TermsGateModal from '../components/TermsGateModal'
import { getTermsAcceptanceFromReq } from '../lib/auth'

export default function Register({ acceptedTermsInitially }){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [acceptingTerms, setAcceptingTerms] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(acceptedTermsInitially)
  const [hasReachedBottom, setHasReachedBottom] = useState(acceptedTermsInitially)
  const router = useRouter()

  async function handleSubmit(e){
    e.preventDefault()
    if(!acceptedTerms) return

    setLoading(true)
    const res = await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
    if(res.ok) router.push('/dashboard')
    else {
      const payload = await res.json().catch(()=>null)
      alert(payload?.error || 'Registration failed')
    }
    setLoading(false)
  }

  async function handleAcceptTerms(){
    if(!hasReachedBottom || acceptingTerms) return

    setAcceptingTerms(true)
    const res = await fetch('/api/auth/terms-accept', { method: 'POST' })

    if(res.ok){
      setAcceptedTerms(true)
      setAcceptingTerms(false)
      return
    }

    setAcceptingTerms(false)
    alert('Unable to record your acceptance right now. Please try again.')
  }

  function handleTermsScroll(event){
    const node = event.currentTarget
    const threshold = 24
    const isAtBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - threshold
    if(isAtBottom) setHasReachedBottom(true)
  }

  return (
    <div className="relative mx-auto max-w-md">
      <Reveal>
        <AnimatedCard className="auth-card p-0 overflow-hidden" hover={false}>
          <motion.div
            className="auth-card-glow"
            animate={{ rotate: -360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          <div className={`relative border-b border-[var(--border)] bg-[rgba(3,12,28,0.82)] px-6 py-5 sketch-frame rounded-t-[22px] transition ${acceptedTerms ? 'opacity-100' : 'opacity-55'}`}>
            <p className="eyebrow">Join Heartstrings Club</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold">Create account</h2>
            <p className="mt-2 text-sm subtle">
              {acceptedTerms
                ? 'Your private space starts here.'
                : 'Read and accept the terms before the form unlocks.'}
            </p>
          </div>
          <form onSubmit={handleSubmit} className={`relative space-y-4 p-6 transition ${acceptedTerms ? 'opacity-100' : 'pointer-events-none opacity-45 blur-[1px]'}`}>
            <label className="block mb-2 text-sm">Email
              <input value={email} onChange={e=>setEmail(e.target.value)} className="input-field" type="email" required disabled={!acceptedTerms || loading} />
            </label>
            <label className="block mb-2 text-sm">Password
              <input value={password} onChange={e=>setPassword(e.target.value)} className="input-field" type="password" minLength={8} required disabled={!acceptedTerms || loading} />
            </label>
            {loading || acceptingTerms ? (
              <SkeletonButton className="h-11 w-full" />
            ) : (
            <button className="soft-button soft-button-primary w-full border-transparent" disabled={!acceptedTerms}>
              Create account
            </button>
            )}
            <p className="text-sm subtle">
              Already have an account? <Link href="/login" className="text-[var(--accent)] underline underline-offset-4">Log in</Link>.
            </p>
          </form>
        </AnimatedCard>
      </Reveal>

      <AnimatePresence>
        {!acceptedTerms ? (
          <TermsGateModal
            accepting={acceptingTerms}
            hasReachedBottom={hasReachedBottom}
            onAccept={handleAcceptTerms}
            onScroll={handleTermsScroll}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export async function getServerSideProps({ req }){
  // Hydrate the modal in the correct state on first render.
  const acceptedTermsInitially = Boolean(getTermsAcceptanceFromReq(req))
  return { props: { acceptedTermsInitially } }
}
