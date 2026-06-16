import { useEffect, useState } from 'react'
import { fetchAuthUser, getCachedAuthUser, subscribeAuthUser } from '../lib/authSession'
import HavenDashboard from '../components/haven/HavenDashboard'

export default function DashboardPage() {
  const [user, setUser] = useState(getCachedAuthUser)

  useEffect(() => {
    let active = true
    fetchAuthUser({ force: true })
      .then((authUser) => {
        if (active && authUser) setUser(authUser)
      })
      .catch(() => {})

    const unsubscribe = subscribeAuthUser((authUser) => {
      if (active) setUser(authUser)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return <HavenDashboard user={user} />
}
