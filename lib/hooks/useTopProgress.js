import { useEffect } from 'react'
import { topProgress } from '../topProgress'

/** Tie a boolean loading flag to the global top progress bar. */
export function useTopProgress(active) {
  useEffect(() => {
    if (!active) return undefined
    topProgress.start()
    return () => topProgress.done()
  }, [active])
}
