import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/** Desktop-first WebGL for landing hero depth — respects reduced motion and low memory. */
export function useLandingWebGL() {
  const reduceMotion = useReducedMotion()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (reduceMotion) {
      setEnabled(false)
      return
    }
    const mq = window.matchMedia('(min-width: 900px)')
    const lowMem = typeof navigator !== 'undefined' && navigator.deviceMemory != null && navigator.deviceMemory < 4

    function update() {
      setEnabled(mq.matches && !lowMem)
    }

    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [reduceMotion])

  return enabled
}
