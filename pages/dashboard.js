import { useEffect, useState } from 'react'
import { fetchAuthUser, getCachedAuthUser } from '../lib/authSession'
import HavenDashboard from '../components/haven/HavenDashboard'

export default function DashboardPage() {
  const [user, setUser] = useState(getCachedAuthUser)

  useEffect(() => {
    fetchAuthUser().then((authUser) => {
      if (authUser) setUser(authUser)
    }).catch(() => {})
  }, [])

  return <HavenDashboard user={user} />
}
