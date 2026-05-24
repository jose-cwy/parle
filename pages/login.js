import { useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import AnimatedCard from '../components/AnimatedCard'
import Reveal from '../components/Reveal'
import SkeletonBlock, { SkeletonButton } from '../components/Skeleton'
import { hoverGlow } from '../lib/motion'

export default function Login(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const router = useRouter()

  async function handleSubmit(e){
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
    if(res.ok) router.push('/letter-to-yourself')
    else {
      const payload = await res.json().catch(()=>null)
      alert(payload?.error || 'Login failed')
    }
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-md">
      <Reveal>
        <AnimatedCard className="auth-card p-0 overflow-hidden" hover={false}>
          <motion.div
            className="auth-card-glow"
            animate={{ rotate: 360 }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative border-b border-[var(--border)] bg-[rgba(3,12,28,0.82)] px-6 py-5 sketch-frame rounded-t-[22px]">
            <p className="eyebrow">Welcome back</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold">Log in</h2>
            <p className="mt-2 text-sm subtle">The door is still open. Continue your journal, chat, and quotes.</p>
          </div>
          <form onSubmit={handleSubmit} className="relative space-y-4 p-6">
            <label className="block mb-2 text-sm">Email
              <input value={email} onChange={e=>setEmail(e.target.value)} className="input-field" type="email" required />
            </label>
            <label className="block mb-2 text-sm">Password
              <input value={password} onChange={e=>setPassword(e.target.value)} className="input-field" type="password" required />
            </label>
            {loading ? (
              <SkeletonButton className="h-11 w-full" />
            ) : (
            <motion.button
              type="submit"
              className="soft-button soft-button-primary w-full border-transparent"
              {...hoverGlow}
            >
              Log in
            </motion.button>
            )}
            <p className="text-sm subtle">Welcome back to your private space.</p>
          </form>
        </AnimatedCard>
      </Reveal>
    </div>
  )
}
