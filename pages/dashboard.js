import { useEffect, useState } from 'react'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import DashboardHome from '../components/DashboardHome'
import AppPage from '../components/app/AppPage'

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [firstTime, setFirstTime] = useState(false)
  const [hasDiary, setHasDiary] = useState(false)
  const [hasLetterDraft, setHasLetterDraft] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => {})

    fetch('/api/letters/self')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setFirstTime(!data?.letter)
        setHasLetterDraft(Boolean(data?.letter && !data.letter.is_completed && data.letter.content))
      })
      .catch(() => {})

    fetch('/api/diary')
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        setHasDiary(Array.isArray(rows) && rows.length > 0)
      })
      .catch(() => {})
  }, [])

  return (
    <RequireAuth>
      <AppShell>
        <AppPage>
        <DashboardHome
          user={user}
          firstTime={firstTime}
          hasDiary={hasDiary}
          hasLetterDraft={hasLetterDraft}
        />
        </AppPage>
      </AppShell>
    </RequireAuth>
  )
}
