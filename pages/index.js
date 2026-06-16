import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { fetchAuthUser, isAuthCacheReady } from '../lib/authSession'
import { hasPreferredName } from '../lib/user'
import LandingSplash from '../components/landing/LandingSplash'
import ParlerLandingPage from '../components/landing/ParlerLandingPage'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(() => !isAuthCacheReady())
  const signupDeclined = router.query.signup === 'declined'

  useEffect(() => {
    let active = true

    fetchAuthUser({ force: true })
      .then((user) => {
        if (!active) return
        if (user) {
          router.replace(hasPreferredName(user) ? '/dashboard' : '/welcome')
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
  }, [])

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
