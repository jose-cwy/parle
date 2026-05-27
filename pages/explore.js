import { useEffect } from 'react'
import { useRouter } from 'next/router'

/** Legacy route — cinematic explore journey was removed */
export default function ExploreRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <div className="landing-page__loading" aria-busy="true">
      <p>Redirecting…</p>
    </div>
  )
}
