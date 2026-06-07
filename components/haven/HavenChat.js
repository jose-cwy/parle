import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bookmark, BookmarkCheck, Send, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { pulseWarmth } from '../../lib/warmthPulse'
import { useSavedQuote } from '../../lib/hooks/useSavedQuote'
import { useTopProgress } from '../../lib/hooks/useTopProgress'
import { track } from '../../lib/events'
import {
  MODES,
  DEFAULT_MODE,
  MODE_SWITCH_ACK,
  DONT_TEXT_OPENING,
  getModeLabel,
} from '../../lib/parle/modes'
import { buildContextRecapBlock } from '../../lib/parle/prompts'

function EntryChip({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3.5 py-2 rounded-full border text-[13px] transition whitespace-nowrap',
        'border-border bg-card hover:bg-secondary hover:border-clay/35 text-foreground/90',
      )}
    >
      {children}
    </button>
  )
}

function EntryScreen({ returningOpening, onSelectMode }) {
  return (
    <div className="flex flex-col px-4 md:px-8 py-6 rise">
      {returningOpening ? (
        <div className="mb-8 flex justify-start">
          <div className="max-w-[78%] py-3 px-5 leading-relaxed text-[15px] text-foreground rounded-[18px] rounded-bl-md bg-card border border-border/70">
            {returningOpening}
          </div>
        </div>
      ) : null}

      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        What do you need right now?
      </p>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
        Comfort first. Advice when you&apos;re ready. You can change this anytime.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {MODES.map((mode) => (
          <EntryChip key={mode.id} onClick={() => onSelectMode(mode)}>
            {mode.label}
          </EntryChip>
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
            : 'text-foreground rounded-[18px] rounded-bl-md px-5 bg-card border border-border/70',
        )}
      >
        {msg.text}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="rise flex justify-start">
      <div className="py-3 px-5 rounded-[18px] rounded-bl-md bg-card border border-border/70 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-clay/70 animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-clay/70 animate-pulse [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-clay/70 animate-pulse [animation-delay:300ms]" />
      </div>
    </div>
  )
}

function ModePicker({ onSelect, onClose }) {
  return (
    <div className="mx-4 md:mx-6 mb-2 rounded-xl border border-border bg-card/95 p-4 rise shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Switch mode
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-0.5"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {MODES.map((mode) => (
          <EntryChip key={mode.id} onClick={() => onSelect(mode)}>
            {mode.label}
          </EntryChip>
        ))}
      </div>
    </div>
  )
}

function createSessionState() {
  return {
    sessionId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    startedAt: Date.now(),
    startingMode: null,
    modeSwitchCount: 0,
    userMessages: [],
    lastAssistantAt: null,
    silenceAfterResponseCount: 0,
    repeatSentimentDetected: false,
    dontTextMessageCount: 0,
    ended: false,
  }
}

export default function HavenChat() {
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)
  const [chatMode, setChatMode] = useState(null)
  const [isAuthed, setIsAuthed] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [returningOpening, setReturningOpening] = useState(null)
  const [quoteRec, setQuoteRec] = useState(null)
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false)
  const [modePickerOpen, setModePickerOpen] = useState(false)
  const [dontTextPhase, setDontTextPhase] = useState(null)
  const [hiddenInjections, setHiddenInjections] = useState([])
  const [isNewSession, setIsNewSession] = useState(true)
  const sessionRef = useRef(createSessionState())
  const lastRecapAt = useRef(0)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const { saved: savedQuote, toggleQuote } = useSavedQuote()

  useTopProgress(messages === null)

  const visibleMessages = (messages || []).filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  )

  const sendSessionEnd = useCallback(async () => {
    const session = sessionRef.current
    if (!isAuthed || session.ended) return
    const userMsgs = session.userMessages
    const currentMessages = (messagesRef.current || []).filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    )
    if (!userMsgs.length && !currentMessages.length) return

    session.ended = true
    const avgLen = userMsgs.length
      ? Math.round(userMsgs.reduce((a, m) => a + m.length, 0) / userMsgs.length)
      : 0
    const avgGap = userMsgs.length
      ? Math.round(userMsgs.reduce((a, m) => a + (m.replyGapSeconds || 0), 0) / userMsgs.length)
      : 0
    const durationMin = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000))
    const transcript = currentMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n')

    await fetch('/api/chat/session-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        message_count: currentMessages.length,
        user_avg_message_length: avgLen,
        avg_reply_gap_seconds: avgGap,
        mode_switches: session.modeSwitchCount,
        starting_mode: session.startingMode || getModeLabel(chatMode?.id),
        final_mode: getModeLabel(chatMode?.id),
        silence_after_response_count: session.silenceAfterResponseCount,
        repeat_sentiment_detected: session.repeatSentimentDetected,
        session_length_minutes: durationMin,
        transcript,
      }),
    }).catch(() => null)
  }, [isAuthed, chatMode?.id])

  useEffect(() => {
    let active = true

    async function init() {
      try {
        const authRes = await fetch('/api/auth/me')
        const authPayload = authRes.ok ? await authRes.json() : { user: null }
        if (!active) return

        const authed = Boolean(authPayload?.user)
        setIsAuthed(authed)

        if (authed) {
          track('chat_loaded', { authed: true })
          const [historyRes, contextRes] = await Promise.all([
            fetch('/api/chat/history'),
            fetch('/api/chat/context'),
          ])
          const rows = historyRes.ok ? await historyRes.json() : []
          const context = contextRes.ok ? await contextRes.json() : {}

          if (!active) return

          setMemoryEnabled(Boolean(context?.memory_enabled))

          const history = (rows || []).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            text: m.text,
          }))

          if (history.length > 0) {
            setMessages(history)
            setChatMode({ id: DEFAULT_MODE.id, ...DEFAULT_MODE })
            setIsNewSession(false)
            sessionRef.current.startingMode = getModeLabel(DEFAULT_MODE.id)
            return
          }

          setMessages([])

          if (context?.memory_enabled && context?.last_session_summary) {
            const openingRes = await fetch('/api/chat/returning-opening', { method: 'POST' })
            const openingPayload = openingRes.ok ? await openingRes.json() : {}
            if (!active) return
            if (openingPayload?.opening) {
              setReturningOpening(openingPayload.opening)
            }
          }
          return
        }

        track('chat_loaded', { authed: false })
        setMessages([])
      } catch {
        if (active) {
          setIsAuthed(false)
          setMessages([])
        }
      }
    }

    init()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const onLeave = () => {
      sendSessionEnd()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('beforeunload', onLeave)
      sendSessionEnd()
    }
  }, [sendSessionEnd])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  async function maybeGenerateRecap(currentMessages, modeId) {
    const count = currentMessages.filter((m) => m.role === 'user' || m.role === 'assistant').length
    if (count < 8 || count % 8 !== 0 || count === lastRecapAt.current) return null

    lastRecapAt.current = count
    const transcript = currentMessages
      .slice(-16)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
      .join('\n')

    const res = await fetch('/api/chat/recap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, modeId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data?.recap) {
      const block = buildContextRecapBlock(data.recap)
      setHiddenInjections((prev) => [...prev, block])
      return block
    }
    return null
  }

  async function checkRepeatSentiment(currentMessages) {
    const res = await fetch('/api/chat/repeat-sentiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recentMessages: currentMessages.slice(-6) }),
    })
    if (!res.ok) return
    const data = await res.json()
    if (data?.repeat) {
      sessionRef.current.repeatSentimentDetected = true
    }
  }

  function startWithMode(mode, { isSwitch = false } = {}) {
    setChatMode({ id: mode.id, style: mode.style, mood: mode.mood })
    setIsNewSession(false)
    setModePickerOpen(false)

    if (!sessionRef.current.startingMode) {
      sessionRef.current.startingMode = mode.label
    }

    if (isSwitch) {
      sessionRef.current.modeSwitchCount += 1
      if (mode.id === 'dont_text') {
        setDontTextPhase('awaiting_unsent')
        sessionRef.current.dontTextMessageCount = 0
        setMessages((prev) => [
          ...(prev || []),
          { role: 'assistant', text: DONT_TEXT_OPENING },
        ])
        return
      }
      const ack = MODE_SWITCH_ACK[mode.id]
      if (ack) {
        setMessages((prev) => [...(prev || []), { role: 'assistant', text: ack }])
      }
      setDontTextPhase(null)
      return
    }

    if (mode.id === 'dont_text') {
      setDontTextPhase('awaiting_unsent')
      sessionRef.current.dontTextMessageCount = 0
      setMessages((prev) => {
        const base = prev?.length ? prev : []
        return [...base, { role: 'assistant', text: DONT_TEXT_OPENING }]
      })
    } else {
      setDontTextPhase(null)
    }

    track('entry_started', { style: mode.id })
  }

  function resolveMode() {
    return chatMode || { id: DEFAULT_MODE.id, ...DEFAULT_MODE }
  }

  async function send(value) {
    const v = String(value || '').trim()
    if (!v || thinking) return

    let mode = resolveMode()
    if (!chatMode) {
      mode = { id: DEFAULT_MODE.id, ...DEFAULT_MODE }
      setChatMode(mode)
      if (!sessionRef.current.startingMode) {
        sessionRef.current.startingMode = DEFAULT_MODE.label
      }
    }

    const now = Date.now()
    const session = sessionRef.current
    const replyGap = session.lastAssistantAt
      ? Math.round((now - session.lastAssistantAt) / 1000)
      : 0
    if (session.lastAssistantAt && replyGap > 60) {
      session.silenceAfterResponseCount += 1
    }

    session.userMessages.push({ length: v.length, sentAt: now, replyGapSeconds: replyGap })

    if (mode.id === 'dont_text') {
      session.dontTextMessageCount += 1
    }

    setText('')
    const nextMessages = [...(messages || []), { role: 'user', text: v }]
    setMessages(nextMessages)
    setThinking(true)

    await checkRepeatSentiment(nextMessages)
    const newRecap = await maybeGenerateRecap(nextMessages, mode.id)
    const injections = newRecap ? [...hiddenInjections, newRecap] : hiddenInjections

    let dontTextStep = null
    if (mode.id === 'dont_text') {
      if (dontTextPhase === 'awaiting_unsent') {
        dontTextStep = 'after_unsent'
        setDontTextPhase('processing')
      } else {
        dontTextStep = 'processing'
      }
    }

    try {
      track('chat_send', { authed: isAuthed, mode: mode.id })

      const endpoint = isAuthed ? '/api/chat/send' : '/api/chat/guest-send'
      const body = {
        text: v,
        modeId: mode.id,
        dontTextStep,
        dontTextMessageCount: session.dontTextMessageCount,
        hiddenInjections: injections,
        isNewSession: isAuthed && isNewSession,
        messages: nextMessages.slice(0, -1),
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...(prev || []), { role: 'assistant', text: data.reply }])
        session.lastAssistantAt = Date.now()
        setIsNewSession(false)
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
      const mode = resolveMode()
      const preferred =
        mode.id === 'dont_text' ? 'Heartbreak'
        : mode.id === 'vent' ? 'Healing'
        : mode.id === 'understand' ? 'Moving On'
        : mode.id === 'honest' ? 'Letting Go'
        : mode.id === 'comfort' ? 'Healing'
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

  async function clearChat() {
    if (thinking) return
    await sendSessionEnd()

    if (isAuthed) {
      await fetch('/api/chat/clear', { method: 'POST' }).catch(() => null)
    }

    setMessages([])
    setChatMode(null)
    setQuoteRec(null)
    setGuestBannerDismissed(false)
    setDontTextPhase(null)
    setHiddenInjections([])
    setModePickerOpen(false)
    setIsNewSession(true)
    lastRecapAt.current = 0
    sessionRef.current = createSessionState()

    if (isAuthed && memoryEnabled) {
      const openingRes = await fetch('/api/chat/returning-opening', { method: 'POST' })
      const openingPayload = openingRes.ok ? await openingRes.json() : {}
      if (openingPayload?.opening) {
        setReturningOpening(openingPayload.opening)
      } else {
        setReturningOpening(null)
      }
    }

    track('chat_deleted', { authed: isAuthed })
  }

  if (messages === null) {
    return null
  }

  const showEntry = !chatMode && !thinking
  const userMessageCount = visibleMessages.filter((m) => m.role === 'user').length
  const showGuestBanner =
    !isAuthed && !guestBannerDismissed && userMessageCount >= 10 && !showEntry
  const showModePill = chatMode && !showEntry
  const showDontTextLabel = chatMode?.id === 'dont_text' && !showEntry

  return (
    <div className="-mt-2 md:-mt-6 min-h-[78vh]">
      <section className="flex flex-col rounded-[22px] border border-border bg-card/60 min-h-[78vh]">
        <header className="px-6 py-4 border-b border-border/70">
          <p className="text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            A safe conversation
          </p>
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-xl text-foreground mt-0.5 truncate">Your conversation</h1>
            {isAuthed ? (
              <button
                type="button"
                onClick={clearChat}
                className="text-[12px] text-muted-foreground hover:text-foreground transition whitespace-nowrap shrink-0"
              >
                Delete chat
              </button>
            ) : null}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6 space-y-4 min-h-[50vh]">
          {showEntry ? (
            <EntryScreen
              returningOpening={returningOpening}
              onSelectMode={(mode) => startWithMode(mode)}
            />
          ) : (
            visibleMessages.map((m, i) => (
              <Bubble key={`${m.role}-${i}-${m.text.slice(0, 8)}`} msg={m} />
            ))
          )}
          {thinking && <TypingIndicator />}
        </div>

        {showGuestBanner && (
          <div className="mx-4 md:mx-6 mb-2 flex items-start gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
            <p className="flex-1 text-muted-foreground leading-relaxed">
              Your chat disappears when you leave. Create a free account to save it.{' '}
              <Link
                href="/register"
                className="text-foreground underline underline-offset-2 hover:text-clay transition"
              >
                Save this chat →
              </Link>
            </p>
            <button
              type="button"
              onClick={() => setGuestBannerDismissed(true)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition p-0.5"
              aria-label="Dismiss"
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}

        {modePickerOpen && (
          <ModePicker
            onSelect={(mode) => startWithMode(mode, { isSwitch: true })}
            onClose={() => setModePickerOpen(false)}
          />
        )}

        {showModePill && (
          <div className="mx-4 md:mx-6 mb-1">
            <button
              type="button"
              onClick={() => setModePickerOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] text-muted-foreground bg-secondary/60 border border-clay/20 hover:border-clay/35 transition"
            >
              <span>{getModeLabel(chatMode.id)}</span>
              <span className="text-muted-foreground/70">· change</span>
            </button>
          </div>
        )}

        {showDontTextLabel && (
          <p className="mx-4 md:mx-6 mb-1 text-[12px] text-muted-foreground">
            Working through the urge to reach out
          </p>
        )}

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
