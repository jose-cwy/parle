import ChatBox from '../components/ChatBox'
import PageIntro from '../components/PageIntro'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'

export default function Chat(){
  return (
    <RequireAuth>
      <AppShell>
        <div className="space-y-6">
          <PageIntro
            eyebrow="Private support"
            title="Chat with Heartstrings AI"
            description="For the nights you keep rereading the messages. Say what happened. Heartstrings listens without judgment, and helps you take the next small step."
          />
          <ChatBox />
        </div>
      </AppShell>
    </RequireAuth>
  )
}
