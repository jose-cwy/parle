import ChatBox from '../components/ChatBox'
import RequireAuth from '../components/RequireAuth'

export default function Chat(){
  return (
    <RequireAuth>
    <div>
      <h2 className="text-xl font-semibold mb-4">Chat with Heartstrings AI</h2>
      <p className="subtle mb-4">Conversations are private and stored securely with your session.</p>
      <ChatBox />
    </div>
    </RequireAuth>
  )
}
