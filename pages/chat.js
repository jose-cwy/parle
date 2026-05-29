import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import HavenChat from '../components/haven/HavenChat'

export default function Chat() {
  return (
    <RequireAuth>
      <AppShell>
        <HavenChat />
      </AppShell>
    </RequireAuth>
  )
}
