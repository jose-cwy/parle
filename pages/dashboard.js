import { useEffect, useState } from 'react'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import HavenDashboard from '../components/haven/HavenDashboard'

export default function DashboardPage() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => {})
  }, [])

  return (
    <RequireAuth>
      <AppShell>
        <HavenDashboard user={user} />
      </AppShell>
    </RequireAuth>
  )
}
