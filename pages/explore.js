import { useEffect } from 'react'
import { useRouter } from 'next/router'
import AppLoading from '../components/loading/AppLoading'

/** Legacy route — cinematic explore journey was removed */
export default function ExploreRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/')
  }, [router])

  return (
    <div className="landing-page__loading">
      <AppLoading message="Almost ready…" fullPage={false} className="hs-app-loading--minimal" />
    </div>
  )
}
