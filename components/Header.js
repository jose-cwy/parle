import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { isAppRoute } from '../lib/routes'
import {
  clearAuthCache,
  fetchAuthUser,
  getCachedAuthUser,
  isAuthCacheReady,
  subscribeAuthUser,
} from '../lib/authSession'
import MarketingNav from './landing/MarketingNav'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState(getCachedAuthUser)
  const [ready, setReady] = useState(isAuthCacheReady)

  useEffect(() => {
    let active = true
    fetchAuthUser({ force: !isAuthCacheReady() })
      .then((authUser) => {
        if (!active) return
        setUser(authUser)
        setReady(true)
      })
      .catch(() => {
        if (active) setReady(true)
      })
    const unsubscribe = subscribeAuthUser((authUser) => {
      setUser(authUser)
      setReady(true)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  if (isAppRoute(router.pathname)) return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    clearAuthCache()
    setUser(null)
    router.push('/')
  }

  return <MarketingNav user={user} ready={ready} onLogout={handleLogout} />
}
