import { useEffect, useState } from 'react'
import { fetchAuthUser, getCachedAuthUser } from '../lib/authSession'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import HavenDashboard from '../components/haven/HavenDashboard'

export default function DashboardPage() {
  const [user, setUser] = useState(getCachedAuthUser)

  useEffect(() => {
    fetchAuthUser().then((authUser) => {
      if (authUser) setUser(authUser)
    }).catch(() => {})
  }, [])

  return (
    <RequireAuth>
      <AppShell>
        <HavenDashboard user={user} />
      </AppShell>
    </RequireAuth>
  )
}
