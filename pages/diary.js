import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import HavenDiary from '../components/haven/HavenDiary'

export default function Diary() {
  return (
    <RequireAuth>
      <AppShell>
        <HavenDiary />
      </AppShell>
    </RequireAuth>
  )
}
