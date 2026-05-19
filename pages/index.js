import AnimatedCard from '../components/AnimatedCard'
import Reveal from '../components/Reveal'
import Link from 'next/link'

export default function Home(){
  return (
    <div>
      <section className="mb-8">
        <Reveal>
        <AnimatedCard className="p-8">
          <h1 className="text-3xl font-bold">Heartstrings Club</h1>
          <p className="subtle mt-2">A gentle space for teen heartbreak support — journal privately, chat with an empathic AI, and explore curated quotes.</p>
          <div className="mt-4 flex gap-3">
            <Link href="/register" className="px-4 py-2 rounded-md" style={{background:'#b79362',color:'#fff'}}>Get Started</Link>
            <Link href="/quotes" className="px-4 py-2 rounded-md subtle card">Explore Quotes</Link>
          </div>
        </AnimatedCard>
        </Reveal>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <Reveal delay={0.05}><AnimatedCard>
          <h3 className="font-semibold">Private Diary</h3>
          <p className="subtle">Write daily reflections, track mood, and view entries on a visual calendar.</p>
        </AnimatedCard></Reveal>
        <Reveal delay={0.1}><AnimatedCard>
          <h3 className="font-semibold">AI Chatbot</h3>
          <p className="subtle">An empathetic companion with persistent memory and safety filters.</p>
        </AnimatedCard></Reveal>
        <Reveal delay={0.15}><AnimatedCard>
          <h3 className="font-semibold">Quotes Book</h3>
          <p className="subtle">Chaptered quotes for heartbreak, healing, self-love, and more.</p>
        </AnimatedCard></Reveal>
      </section>
    </div>
  )
}
