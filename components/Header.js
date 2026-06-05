import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { isAppRoute } from '../lib/routes'
import MarketingNav from './landing/MarketingNav'

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    setReady(false)
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!active) return
        if (res.ok) {
          const payload = await res.json()
          setUser(payload.user || null)
        }
        setReady(true)
      })
      .catch(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [router.asPath])

  if (isAppRoute(router.pathname)) return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
  }

  return <MarketingNav user={user} ready={ready} onLogout={handleLogout} />
}
