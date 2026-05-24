import ChatBox from '../components/ChatBox'
import PageIntro from '../components/PageIntro'
import RequireAuth from '../components/RequireAuth'

export default function Chat(){
  return (
    <RequireAuth>
      <div className="space-y-6">
        <PageIntro
          eyebrow="Private support"
          title="Chat with Heartstrings AI"
          description="Conversations stay private to your session, with fluid message transitions and a live-feeling interface."
        />
        <ChatBox />
      </div>
    </RequireAuth>
  )
}
