import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import HavenJournal from '../components/haven/HavenJournal'

export default function Journal() {
  return (
    <RequireAuth>
      <AppShell>
        <HavenJournal />
      </AppShell>
    </RequireAuth>
  )
}
