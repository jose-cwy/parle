import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import LandingPage from '../components/landing/LandingPage'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        if (data?.user) {
          router.replace('/dashboard')
          return
        }
        setLoggedIn(false)
        setChecking(false)
      })
      .catch(() => {
        if (active) setChecking(false)
      })
    return () => { active = false }
  }, [router])

  if (checking) {
    return (
      <div className="landing-page__loading" aria-busy="true">
        <p>Loading…</p>
      </div>
    )
  }

  return <LandingPage loggedIn={loggedIn} />
}
