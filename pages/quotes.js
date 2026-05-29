import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import HavenQuotes from '../components/haven/HavenQuotes'

export default function Quotes() {
  return (
    <RequireAuth>
      <AppShell>
        <HavenQuotes />
      </AppShell>
    </RequireAuth>
  )
}
