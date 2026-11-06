import HavenChat from '../components/haven/HavenChat'
import HavenChatV2 from '../components/haven/HavenChatV2'

export default function Chat() {
  if (String(process.env.NEXT_PUBLIC_PARLE_V2_SURFACE || '') === '1') {
    return <HavenChatV2 />
  }
  return <HavenChat />
}
