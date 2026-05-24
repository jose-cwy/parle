import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { SkeletonAuthGate } from './Skeleton'

export default function RequireAuth({ children }){
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

  if(!ready) return <SkeletonAuthGate />
  return children
}
