import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/router'
import AnimatedCard from '../components/AnimatedCard'
import Reveal from '../components/Reveal'
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
    if(res.ok) router.push('/letter-to-yourself')
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
          <div className={`relative border-b border-[rgba(140,97,71,0.12)] bg-white/40 px-6 py-5 transition ${acceptedTerms ? 'opacity-100' : 'opacity-55'}`}>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8c6147]">Join Heartstrings Club</p>
            <h2 className="mt-2 font-semibold text-2xl">Create account</h2>
            <p className="mt-2 text-sm subtle">
              {acceptedTerms
                ? 'Your private space starts here.'
                : 'Read and accept the terms before the form unlocks.'}
            </p>
          </div>
          <form onSubmit={handleSubmit} className={`relative space-y-4 p-6 transition ${acceptedTerms ? 'opacity-100' : 'pointer-events-none opacity-45 blur-[1px]'}`}>
            <label className="block mb-2">Email
              <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full mt-1 rounded-xl border border-[rgba(140,97,71,0.14)] bg-white/70 p-3 outline-none transition focus:border-[#b88957]" type="email" required disabled={!acceptedTerms || loading} />
            </label>
            <label className="block mb-2">Password
              <input value={password} onChange={e=>setPassword(e.target.value)} className="w-full mt-1 rounded-xl border border-[rgba(140,97,71,0.14)] bg-white/70 p-3 outline-none transition focus:border-[#b88957]" type="password" minLength={8} required disabled={!acceptedTerms || loading} />
            </label>
            <button className="soft-button w-full bg-[#b88957] text-white border-transparent" disabled={loading || !acceptedTerms}>{loading? '...' : 'Create account'}</button>
            <p className="text-sm subtle">
              Already have an account? <Link href="/login" className="text-[#8c6147] underline underline-offset-4">Log in</Link>.
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
