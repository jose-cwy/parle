import ChatBox from '../components/ChatBox'
import RequireAuth from '../components/RequireAuth'
import Reveal from '../components/Reveal'

export default function Chat(){
  return (
    <RequireAuth>
      <div className="space-y-6">
        <Reveal>
          <div className="grid gap-3 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Private support</p>
              <h2 className="mt-2 section-title text-[#241e1a]">Chat with Heartstrings AI</h2>
            </div>
            <p className="subtle text-base leading-7">Conversations stay private to your session, with gentler transitions and a live-feeling interface instead of a flat message wall.</p>
          </div>
        </Reveal>
        <ChatBox />
      </div>
    </RequireAuth>
  )
}
