import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import TopProgressBar from './TopProgressBar'
import { topProgress } from '../lib/topProgress'

export default function TopProgressProvider({ children }) {
  const router = useRouter()
  const [barState, setBarState] = useState({
    visible: false,
    opacity: 0,
    width: 0,
    completing: false,
  })

  useEffect(() => topProgress.subscribe(setBarState), [])

  useEffect(() => {
    function onStart() {
      topProgress.start()
    }

    function onDone() {
      topProgress.done()
    }

    router.events.on('routeChangeStart', onStart)
    router.events.on('routeChangeComplete', onDone)
    router.events.on('routeChangeError', onDone)

    return () => {
      router.events.off('routeChangeStart', onStart)
      router.events.off('routeChangeComplete', onDone)
      router.events.off('routeChangeError', onDone)
    }
  }, [router.events])

  return (
    <>
      <TopProgressBar {...barState} />
      {children}
    </>
  )
}
