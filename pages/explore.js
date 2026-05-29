import { useEffect } from 'react'
import { useRouter } from 'next/router'
import LandingSplash from '../components/landing/LandingSplash'

/** Legacy route — cinematic explore journey was removed */
export default function ExploreRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <LandingSplash message="Almost ready…" statusLabel="Taking you home" />
  )
}
