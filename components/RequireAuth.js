import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'

/**
 * Client-side route guard for protected pages.
 */
export default function RequireAuth({children}){
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(()=>{
    fetch('/api/auth/me').then(r=>{
      if(!r.ok) {
        router.push('/login')
        return
      }
      r.json().then(payload => {
        if(!payload?.user) router.push('/login')
        else setReady(true)
      })
    })
  },[router])

  if(!ready) {
    return (
      <motion.div
        className="card mx-auto max-w-xl p-8 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-[rgba(140,97,71,0.2)] border-t-[#b88957] spinner-ring" />
        <p className="text-lg font-semibold text-[#241e1a]">Preparing your private space</p>
        <p className="mt-2 subtle">Checking your session and loading the next view.</p>
      </motion.div>
    )
  }
  return children
}
