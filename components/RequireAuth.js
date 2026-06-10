import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  clearAuthCache,
  fetchAuthUser,
  getCachedAuthUser,
} from '../lib/authSession'
import { useTopProgress } from '../lib/hooks/useTopProgress'
import { hasPreferredName } from '../lib/user'

export function clearVerifiedAuthCache() {
  clearAuthCache()
}

function canAccessApp(user) {
  return Boolean(user && hasPreferredName(user))
}

export default function RequireAuth({ children }){
  const [ready, setReady] = useState(() => canAccessApp(getCachedAuthUser()))
  const router = useRouter()

  useEffect(()=>{
    let active = true

    async function verify() {
      const user = await fetchAuthUser()
      if (!active) return

      if (!user) {
        router.push(`/login?next=${encodeURIComponent(router.asPath)}`)
        return
      }
      if (!hasPreferredName(user)) {
        router.push('/welcome')
        return
      }
      setReady(true)
    }

    verify()
    return () => {
      active = false
    }
  }, [router.asPath, router])

  useTopProgress(!ready)

  if(!ready) return null
  return children
}
