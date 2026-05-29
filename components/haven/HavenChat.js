import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '../../lib/cn'
import { pulseWarmth } from '../../lib/warmthPulse'

const PROMPTS = [
  'I miss them',
  'I feel angry',
  'Help me move on',
  'I keep rereading our messages',
  "I don't know what I feel",
  "Help me write what I can't say",
]

function EmptyState({ onPick }) {
  return (
    <div className="h-full min-h-[40vh] flex flex-col items-center justify-center text-center px-4 rise">
      <p className="font-serif text-2xl md:text-[28px] text-foreground max-w-md leading-snug">
        Start with one sentence. <span className="italic text-clay">I&apos;m here.</span>
      </p>
      <p className="mt-3 text-sm text-muted-foreground max-w-sm">
        Or borrow someone else&apos;s words to begin.
      </p>
      <div className="mt-7 flex flex-wrap gap-2 justify-center max-w-xl">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="px-3.5 py-2 rounded-full border border-border bg-card hover:bg-secondary hover:border-clay/40 text-[13px] text-foreground/90 transition"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({ msg }) {
  const isYou = msg.role === 'user'
  return (
    <div className={`rise flex ${isYou ? 'justify-end' : 'justify-start'}`}>
      <div
        className={cn(
          'max-w-[78%] py-3 leading-relaxed text-[15px]',
          isYou
            ? 'bg-secondary text-foreground rounded-[18px] rounded-br-md px-5'
            : 'text-foreground rounded-[18px] rounded-bl-md px-5 bg-[oklch(0.98_0.012_82)] border border-border/70',
        )}
      >
        {msg.text}
      </div>
    </div>
  )
}

export default function HavenChat() {
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    fetch('/api/chat/history')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) =>
        setMessages(
          (rows || []).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            text: m.text,
          })),
        ),
      )
      .catch(() => setMessages([]))
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  async function send(value) {
    const v = String(value || '').trim()
    if (!v || thinking) return
    setText('')
    setMessages((prev) => [...(prev || []), { role: 'user', text: v }])
    setThinking(true)
    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: v }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...(prev || []), { role: 'assistant', text: data.reply }])
        pulseWarmth(1, 1600)
        await fetch('/api/gamification/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deltaChat: 1 }),
        }).catch(() => null)
      } else {
        setMessages((prev) => [
          ...(prev || []),
          { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...(prev || []),
        { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setThinking(false)
    }
  }

  if (messages === null) {
    return (
      <div className="rounded-[22px] border border-border bg-card/60 p-6 space-y-4">
        <div className="skeleton-soft h-6 w-48" />
        <div className="skeleton-soft h-64 w-full" />
        <div className="skeleton-soft h-12 w-full" />
      </div>
    )
  }

  const title =
    messages.length > 0
      ? messages.find((m) => m.role === 'user')?.text.slice(0, 42) || 'Your conversation'
      : 'Your conversation'

  return (
    <div className="-mt-2 md:-mt-6 min-h-[78vh]">
      <section className="flex flex-col rounded-[22px] border border-border bg-card/60 min-h-[78vh]">
        <header className="px-6 py-4 border-b border-border/70">
          <p className="text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            A safe conversation
          </p>
          <h1 className="font-serif text-xl text-foreground mt-0.5 truncate">{title}</h1>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 space-y-4 min-h-[50vh]">
          {messages.length === 0 && !thinking ? (
            <EmptyState onPick={send} />
          ) : (
            messages.map((m, i) => <Bubble key={`${m.role}-${i}-${m.text.slice(0, 8)}`} msg={m} />)
          )}
          {thinking && (
            <div className="flex gap-1.5 items-center pl-2">
              <span className="h-1.5 w-1.5 rounded-full bg-clay/70 animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-clay/70 animate-pulse [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-clay/70 animate-pulse [animation-delay:240ms]" />
              <span className="ml-2 text-[11.5px] text-muted-foreground italic">listening…</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(text)
          }}
          className="m-4 md:m-6 mt-0 flex items-end gap-2 bg-background rounded-2xl border border-border focus-within:border-clay/60 focus-within:ring-2 focus-within:ring-clay/15 transition p-2 pl-5"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(text)
              }
            }}
            rows={1}
            placeholder="Say what's on your mind..."
            className="flex-1 resize-none bg-transparent outline-none py-3 text-[15px] placeholder:text-muted-foreground/70 max-h-40"
            disabled={thinking}
          />
          <button
            type="submit"
            className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-90 active:scale-95 transition disabled:opacity-40"
            disabled={!text.trim() || thinking}
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </form>
      </section>
    </div>
  )
}
