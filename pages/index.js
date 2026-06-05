import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import LandingSplash from '../components/landing/LandingSplash'
import ParlerLandingPage from '../components/landing/ParlerLandingPage'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const signupDeclined = router.query.signup === 'declined'

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
        setChecking(false)
      })
      .catch(() => {
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [router])

  if (checking) {
    return <LandingSplash />
  }

  return (
    <>
      <Head>
        <title>parlé — A private space for heartbreak</title>
        <meta
          name="description"
          content="A private digital space for young people to share thoughts, feelings, and heartbreak stories safely and anonymously."
        />
        <meta property="og:title" content="parlé — A private space for heartbreak" />
        <meta property="og:description" content="Comfort first. Advice when you're ready." />
      </Head>
      <ParlerLandingPage signupDeclined={signupDeclined} />
    </>
  )
}
