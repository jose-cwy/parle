import Link from 'next/link'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import ParleSettings from '../components/haven/ParleSettings'

export default function SettingsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-6 md:py-10">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition mb-6"
          >
            ← Back to chat
          </Link>
          <ParleSettings />
        </div>
      </AppShell>
    </RequireAuth>
  )
}
