import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AuthLoading from './loading/AuthLoading'

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
        if(!payload?.user) router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
        else setReady(true)
      })
    })
  },[router])

  if(!ready) return <AuthLoading />
  return children
}
