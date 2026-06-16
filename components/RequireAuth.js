import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import {
  clearAuthCache,
  fetchAuthUser,
  getCachedAuthUser,
} from '../lib/authSession'
import { useTopProgress } from '../lib/hooks/useTopProgress'
import { hasPreferredName } from '../lib/user'

export function clearVerifiedAuthCache() {
  clearAuthCache()
}

function canAccessApp(user) {
  return Boolean(user && hasPreferredName(user))
}

export default function RequireAuth({ children, enabled = true }) {
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!enabled) {
      setReady(true)
      return undefined
    }

    let active = true

    async function verify() {
      setReady(false)
      const user = await fetchAuthUser({ force: true })
      if (!active) return

      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(router.asPath)}`)
        return
      }
      if (!hasPreferredName(user)) {
        router.replace('/welcome')
        return
      }
      setReady(true)
    }

    verify()
    return () => {
      active = false
    }
  }, [enabled, router.asPath, router])

  useTopProgress(enabled && !ready)

  if (!enabled) return children
  if (!ready) return null
  return children
}
