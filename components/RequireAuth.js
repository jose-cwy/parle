import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

/**
 * Client-side route guard for protected pages.
 */
export default function RequireAuth({children}){
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(()=>{
    fetch('/api/auth/me').then(r=>{
      if(!r.ok) router.push('/login')
      else setReady(true)
    })
  },[router])

  if(!ready) return <div className="subtle">Loading...</div>
  return children
}
