import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, Sparkles, Send } from 'lucide-react'
import { cn } from '../../lib/cn'
import { pulseWarmth } from '../../lib/warmthPulse'
import HavenModal from './HavenModal'
import { journalClientHeaders } from '../../lib/journalClientDate'
import { todayKey } from '../../lib/haven/dates'
import { useSavedQuote } from '../../lib/hooks/useSavedQuote'
import { track } from '../../lib/events'

const MOODS = [
  { id: 'miss', label: 'I miss them' },
  { id: 'text', label: 'I want to text them' },
  { id: 'alone', label: 'I feel alone' },
  { id: 'vent', label: 'I just want to vent' },
  { id: 'understand', label: 'Help me understand what happened' },
  { id: 'advice', label: 'I need advice' },
  { id: 'truth', label: 'I need harsh truth' },
]

const STYLES = [
  { id: 'listen', label: 'Just listen' },
  { id: 'comfort', label: 'Comfort me first' },
  { id: 'comfort_then_advice', label: 'Advice after comfort' },
  { id: 'honest', label: 'Give me the honest truth' },
  { id: 'dont_text', label: "Stop me from texting them" },
]

const STARTERS = [
  "I don't know what to say.",
  "I keep replaying it in my head.",
  "I'm trying not to text them.",
  "I feel embarrassed that I'm still stuck on this.",
  'I miss them more at night.',
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
        {STARTERS.map((p) => (
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

function EntryChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3.5 py-2 rounded-full border text-[13px] transition whitespace-nowrap',
        active
          ? 'bg-secondary border-clay/45 text-foreground'
          : 'border-border bg-card hover:bg-secondary hover:border-clay/35 text-foreground/90',
      )}
    >
      {children}
    </button>
  )
}

function EntryScreen({ onStart }) {
  const [mood, setMood] = useState(MOODS[0].id)
  const [style, setStyle] = useState(STYLES[1].id)

  return (
    <div className="h-full min-h-[52vh] flex flex-col justify-center px-4 md:px-8 rise">
      <p className="text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
        Talk now
      </p>
      <h1 className="mt-2 font-serif text-2xl md:text-[28px] text-foreground leading-snug max-w-2xl">
        Choose what you need right now.
      </h1>
      <p className="mt-3 text-sm text-muted-foreground max-w-2xl leading-relaxed">
        Comfort first. Advice when you&apos;re ready. You can change this anytime.
      </p>

      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          How are you feeling?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <EntryChip key={m.id} active={mood === m.id} onClick={() => setMood(m.id)}>
              {m.label}
            </EntryChip>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          How should I respond?
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <EntryChip key={s.id} active={style === s.id} onClick={() => setStyle(s.id)}>
              {s.label}
            </EntryChip>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <button
          type="button"
          onClick={() => {
            track('entry_started', { mood, style })
            onStart({ mood, style })
          }}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.99] transition"
        >
          <Sparkles size={16} />
          Start talking
        </button>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
          Private by default. You can delete this chat anytime.
        </p>
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
            : 'text-foreground rounded-[18px] rounded-bl-md px-5 bg-card border border-border/70',
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
  const [chatMode, setChatMode] = useState(null)
  const [isAuthed, setIsAuthed] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memoryDraft, setMemoryDraft] = useState('')
  const [savingMemory, setSavingMemory] = useState(false)
  const [memoryStatus, setMemoryStatus] = useState('')
  const [reflectOpen, setReflectOpen] = useState(false)
  const [reflectDraft, setReflectDraft] = useState('')
  const [reflectStatus, setReflectStatus] = useState('')
  const [reflectBusy, setReflectBusy] = useState(false)
  const [quoteRec, setQuoteRec] = useState(null)
  const { saved: savedQuote, toggleQuote } = useSavedQuote()

  const storageKey = useMemo(() => 'hsc.chat.guest.v1', [])

  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((payload) => {
        if (!active) return
        const authed = Boolean(payload?.user)
        setIsAuthed(authed)

        if (authed) {
          track('chat_loaded', { authed: true })
          fetch('/api/chat/history')
            .then((r) => (r.ok ? r.json() : []))
            .then((rows) => {
              if (!active) return
              setMessages(
                (rows || []).map((m) => ({
                  role: m.role === 'user' ? 'user' : 'assistant',
                  text: m.text,
                })),
              )
            })
            .catch(() => {
              if (active) setMessages([])
            })
          return
        }

        track('chat_loaded', { authed: false })
        try {
          const raw = localStorage.getItem(storageKey)
          const parsed = raw ? JSON.parse(raw) : null
          const guestMsgs = Array.isArray(parsed?.messages) ? parsed.messages : []
          const guestMode = parsed?.mode || null
          setChatMode(guestMode)
          setMessages(
            guestMsgs.map((m) => ({
              role: m?.role === 'user' ? 'user' : 'assistant',
              text: String(m?.text || ''),
            })),
          )
        } catch {
          setMessages([])
        }
      })
      .catch(() => {
        if (!active) return
        setIsAuthed(false)
        try {
          const raw = localStorage.getItem(storageKey)
          const parsed = raw ? JSON.parse(raw) : null
          const guestMsgs = Array.isArray(parsed?.messages) ? parsed.messages : []
          const guestMode = parsed?.mode || null
          setChatMode(guestMode)
          setMessages(
            guestMsgs.map((m) => ({
              role: m?.role === 'user' ? 'user' : 'assistant',
              text: String(m?.text || ''),
            })),
          )
        } catch {
          setMessages([])
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (messages === null || isAuthed) return
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          mode: chatMode,
          messages,
          updatedAt: new Date().toISOString(),
        }),
      )
    } catch {
      /* ignore */
    }
  }, [messages, chatMode, isAuthed, storageKey])

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
      track('chat_send', { authed: isAuthed, mood: chatMode?.mood || '', style: chatMode?.style || '' })
      if (chatMode?.style === 'dont_text') {
        const gentle = [
          "Okay. Let's pause together for a second.",
          'What do you want to text them right now—word for word?',
          "You can paste it here. We can rewrite it into something you don't send, or turn it into an unsent message for you.",
        ].join(' ')
        setMessages((prev) => [...(prev || []), { role: 'assistant', text: gentle }])
        pulseWarmth(1, 1400)
        track('no_contact_mode_used', { authed: isAuthed })
        return
      }

      const endpoint = isAuthed ? '/api/chat/send' : '/api/chat/guest-send'
      const body =
        endpoint === '/api/chat/send'
          ? { text: v, mood: chatMode?.mood, style: chatMode?.style }
          : { text: v, mood: chatMode?.mood, style: chatMode?.style, messages: messages || [] }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...(prev || []), { role: 'assistant', text: data.reply }])
        pulseWarmth(1, 1600)
        recommendQuote(v)
        track('chat_reply', { authed: isAuthed, safety: Boolean(data?.safety) })
        if (isAuthed) {
          await fetch('/api/gamification/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deltaChat: 1 }),
          }).catch(() => null)
        }
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

  async function recommendQuote(latestUserText) {
    try {
      const res = await fetch('/api/quotes')
      if (!res.ok) return
      const chapters = await res.json()
      const preferred =
        chatMode?.mood === 'miss' || chatMode?.mood === 'text' ? 'Heartbreak'
        : chatMode?.mood === 'alone' || chatMode?.mood === 'vent' ? 'Healing'
        : chatMode?.mood === 'truth' ? 'Letting Go'
        : chatMode?.mood === 'advice' ? 'Self-Worth'
        : chatMode?.mood === 'understand' ? 'Moving On'
        : null

      const chapterNames = Object.keys(chapters || {})
      const chosenChapter = preferred && chapters[preferred] ? preferred : chapterNames[0]
      const list = (chapters?.[chosenChapter] || []).filter(Boolean)
      if (!list.length) return

      const seed = String(latestUserText || '').length % list.length
      const pick = list[seed] || list[0]
      setQuoteRec({ ...pick, chapter: chosenChapter })
    } catch {
      /* ignore */
    }
  }

  async function openReflection() {
    if (!messages?.length) return
    setReflectStatus('')
    setReflectOpen(true)
    setReflectBusy(true)
    setReflectDraft('')
    track('reflection_opened', { authed: isAuthed })

    const compact = (messages || [])
      .slice(-16)
      .map((m) => `${m.role === 'user' ? 'You' : 'Heartstrings'}: ${m.text}`)
      .join('\n')

    try {
      const res = await fetch('/api/chat/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: compact, mood: chatMode?.mood, style: chatMode?.style }),
      })
      const payload = res.ok ? await res.json() : null
      const draft = String(payload?.reflection || '').trim()
      setReflectDraft(draft || 'Mood: \nTrigger: \nFeeling: \nNeeded: \nReminder: ')
    } catch {
      setReflectDraft('Mood: \nTrigger: \nFeeling: \nNeeded: \nReminder: ')
    } finally {
      setReflectBusy(false)
    }
  }

  async function saveReflectionToJournal() {
    if (!isAuthed) {
      setReflectStatus('Sign up to save reflections to your journal.')
      return
    }
    const content = String(reflectDraft || '').trim()
    if (!content) return

    setReflectBusy(true)
    setReflectStatus('')
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...journalClientHeaders(todayKey()),
        },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        setReflectStatus("Saved to today's journal.")
        track('reflection_saved', {})
        return
      }

      const payload = await res.json().catch(() => ({}))
      if (res.status === 409 && payload?.id) {
        const put = await fetch(`/api/journal/${payload.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...journalClientHeaders(todayKey()),
          },
          body: JSON.stringify({ content }),
        })
        if (put.ok) {
          setReflectStatus("Saved to today's journal.")
          track('reflection_saved', {})
        } else {
          setReflectStatus('Could not save right now.')
        }
        return
      }

      setReflectStatus(payload?.error || 'Could not save right now.')
    } catch {
      setReflectStatus('Could not save right now.')
    } finally {
      setReflectBusy(false)
    }
  }

  async function clearChat() {
    if (thinking) return

    if (isAuthed) {
      await fetch('/api/chat/clear', { method: 'POST' }).catch(() => null)
    } else {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        /* ignore */
      }
    }

    setMessages([])
    setChatMode(null)
    track('chat_deleted', { authed: isAuthed })
  }

  async function openMemory() {
    if (!isAuthed) {
      setMemoryStatus('Sign up to save memory.')
      setMemoryOpen(true)
      return
    }

    setMemoryStatus('')
    setMemoryOpen(true)
    setSavingMemory(true)
    try {
      const res = await fetch('/api/memory')
      const payload = res.ok ? await res.json() : { memory: {} }
      const m = payload?.memory || {}
      setMemoryDraft(m?.note ? String(m.note) : '')
    } catch {
      setMemoryDraft('')
    } finally {
      setSavingMemory(false)
    }
  }

  async function saveMemory() {
    if (!isAuthed) return
    if (savingMemory) return
    setSavingMemory(true)
    setMemoryStatus('')
    try {
      const res = await fetch('/api/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory: { note: memoryDraft.trim() } }),
      })
      if (res.ok) {
        setMemoryStatus('Saved.')
        track('memory_saved', {})
      } else {
        setMemoryStatus('Could not save right now.')
      }
    } catch {
      setMemoryStatus('Could not save right now.')
    } finally {
      setSavingMemory(false)
    }
  }

  async function clearMemory() {
    if (!isAuthed) return
    if (savingMemory) return
    setSavingMemory(true)
    setMemoryStatus('')
    try {
      const res = await fetch('/api/memory', { method: 'DELETE' })
      if (res.ok) {
        setMemoryDraft('')
        setMemoryStatus('Cleared.')
        track('memory_cleared', {})
      } else {
        setMemoryStatus('Could not clear right now.')
      }
    } catch {
      setMemoryStatus('Could not clear right now.')
    } finally {
      setSavingMemory(false)
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
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-xl text-foreground mt-0.5 truncate">{title}</h1>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openReflection}
                className="text-[12px] text-muted-foreground hover:text-foreground transition whitespace-nowrap"
              >
                Save as reflection
              </button>
              <button
                type="button"
                onClick={openMemory}
                className="text-[12px] text-muted-foreground hover:text-foreground transition whitespace-nowrap"
              >
                What I should remember
              </button>
              <button
                type="button"
                onClick={clearChat}
                className="text-[12px] text-muted-foreground hover:text-foreground transition whitespace-nowrap"
              >
                Delete chat
              </button>
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 space-y-4 min-h-[50vh]">
          {!chatMode && messages.length === 0 && !thinking ? (
            <EntryScreen
              onStart={(mode) => {
                setChatMode(mode)
              }}
            />
          ) : messages.length === 0 && !thinking ? (
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

      {memoryOpen && (
        <HavenModal onClose={() => setMemoryOpen(false)} small>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            What I should remember
          </p>
          <h2 className="mt-2 font-serif text-2xl text-foreground">Only if you want.</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Keep this minimal. A nickname, what happened, what you struggle with most, and how you prefer support.
            You can clear it anytime.
          </p>

          {!isAuthed ? (
            <div className="mt-5">
              <p className="text-sm text-muted-foreground">
                {memoryStatus || 'To keep memory across sessions, create an account.'}
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <textarea
                value={memoryDraft}
                onChange={(e) => setMemoryDraft(e.target.value)}
                className="w-full min-h-[110px] resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-clay/15 focus:border-clay/50"
                placeholder="Example: Nickname: “J”. We stopped talking after an argument. I spiral at night. Comfort first, then one small next step."
                disabled={savingMemory}
              />
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{memoryStatus || '\u00A0'}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={clearMemory}
                    className="h-9 px-3 rounded-xl border border-border text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                    disabled={savingMemory}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={saveMemory}
                    className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-[13px] hover:opacity-90 transition disabled:opacity-50"
                    disabled={savingMemory}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </HavenModal>
      )}

      {reflectOpen && (
        <HavenModal onClose={() => setReflectOpen(false)}>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Private reflection
          </p>
          <h2 className="mt-2 font-serif text-2xl text-foreground">Save this for later?</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            We’ll turn this moment into a short reflection you can edit. Nothing is shared.
          </p>

          <div className="mt-5">
            <textarea
              value={reflectDraft}
              onChange={(e) => setReflectDraft(e.target.value)}
              className="w-full min-h-[170px] resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-clay/15 focus:border-clay/50"
              disabled={reflectBusy}
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{reflectStatus || '\u00A0'}</p>
              <button
                type="button"
                onClick={saveReflectionToJournal}
                className="h-9 px-3.5 rounded-xl bg-primary text-primary-foreground text-[13px] hover:opacity-90 transition disabled:opacity-50"
                disabled={reflectBusy || !reflectDraft.trim()}
              >
                Save to today&apos;s journal
              </button>
            </div>
          </div>
        </HavenModal>
      )}

      {quoteRec && (
        <div className="mt-5 rounded-[22px] border border-border bg-secondary/40 p-5">
          <p className="text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            A line that might fit
          </p>
          <p className="mt-2 font-serif text-[18px] text-foreground leading-snug">
            &ldquo;{quoteRec.text}&rdquo;
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">— {quoteRec.author}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {quoteRec.chapter}
            </p>
            <button
              type="button"
              onClick={() => toggleQuote(quoteRec, quoteRec.chapter)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] transition-all shrink-0',
                savedQuote?.id === quoteRec.id
                  ? 'bg-rose/15 text-clay border border-rose/40'
                  : 'text-muted-foreground hover:text-clay border border-transparent hover:bg-secondary',
              )}
            >
              {savedQuote?.id === quoteRec.id ? (
                <BookmarkCheck size={13} strokeWidth={2} />
              ) : (
                <Bookmark size={13} strokeWidth={1.7} />
              )}
              {savedQuote?.id === quoteRec.id ? 'Kept' : 'Keep this line'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
