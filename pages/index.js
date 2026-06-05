import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import LandingHero from '../components/landing/LandingHero'
import LandingSplash from '../components/landing/LandingSplash'
import LandingHowItWorks from '../components/landing/LandingHowItWorks'
import LandingTestimonialCarousel from '../components/landing/LandingTestimonialCarousel'
import LandingClosingCta from '../components/landing/LandingClosingCta'
import LandingFooter from '../components/landing/LandingFooter'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const signupDeclined = router.query.signup === 'declined'
  const containerRef = useRef(null)

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
    return () => { active = false }
  }, [router])

  if (checking) {
    return <LandingSplash />
  }

  return (
    <div ref={containerRef} className="landing-figma">
      {signupDeclined ? (
        <div className="landing-hero-page__notice px-6" role="status">
          <p>
            You chose not to accept the Terms &amp; Safety Agreement, so account creation is not available.
            You can review the agreement again from the{' '}
            <Link href="/register">signup page</Link> when you are ready.
          </p>
        </div>
      ) : null}

      <LandingHero />
      <LandingHowItWorks />
      <LandingTestimonialCarousel />
      <LandingClosingCta />
      <LandingFooter />
    </div>
  )
}
