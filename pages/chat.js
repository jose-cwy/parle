import ChatBox from '../components/ChatBox'
import PageIntro from '../components/PageIntro'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import AppPage from '../components/app/AppPage'

export default function Chat(){
  return (
    <RequireAuth>
      <AppShell>
        <AppPage>
          <PageIntro
            eyebrow="Private support"
            title="Chat with Heartstrings"
            description="For the nights you keep rereading the messages. Say what happened — one sentence at a time."
          />
          <ChatBox />
        </AppPage>
      </AppShell>
    </RequireAuth>
  )
}
