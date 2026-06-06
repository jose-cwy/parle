import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useTopProgress } from '../lib/hooks/useTopProgress'
import { hasPreferredName } from '../lib/user'

export default function RequireAuth({ children }){
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(()=>{
    fetch('/api/auth/me').then(r=>{
      if(!r.ok) {
        router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
        return
      }
      r.json().then(payload => {
        if(!payload?.user) {
          router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
          return
        }
        if (!hasPreferredName(payload.user)) {
          router.push('/welcome')
          return
        }
        setReady(true)
      })
    })
  },[router])

  useTopProgress(!ready)

  if(!ready) return null
  return children
}
