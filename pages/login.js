import { useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import AnimatedCard from '../components/AnimatedCard'
import Reveal from '../components/Reveal'

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
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative border-b border-[rgba(140,97,71,0.12)] bg-white/40 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8c6147]">Welcome back</p>
            <h2 className="mt-2 font-semibold text-2xl">Log in</h2>
            <p className="mt-2 text-sm subtle">Continue your journal, chat, and quote journey.</p>
          </div>
          <form onSubmit={handleSubmit} className="relative space-y-4 p-6">
            <label className="block mb-2">Email
              <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full mt-1 rounded-xl border border-[rgba(140,97,71,0.14)] bg-white/70 p-3 outline-none transition focus:border-[#b88957]" type="email" required />
            </label>
            <label className="block mb-2">Password
              <input value={password} onChange={e=>setPassword(e.target.value)} className="w-full mt-1 rounded-xl border border-[rgba(140,97,71,0.14)] bg-white/70 p-3 outline-none transition focus:border-[#b88957]" type="password" required />
            </label>
            <button className="soft-button w-full bg-[#b88957] text-white border-transparent" disabled={loading}>{loading? '...' : 'Log in'}</button>
            <p className="text-sm subtle">Welcome back to your private space.</p>
          </form>
        </AnimatedCard>
      </Reveal>
    </div>
  )
}
