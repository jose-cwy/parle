import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bookmark, BookmarkCheck, Lock, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { pulseWarmth } from '../../lib/warmthPulse'
import { useSavedQuote } from '../../lib/hooks/useSavedQuote'
import { useTopProgress } from '../../lib/hooks/useTopProgress'
import { track } from '../../lib/events'
import ChatInputBar from './ChatInputBar'
import ParleChatSidebar from './ParleChatSidebar'
import {
  DEFAULT_MODE,
  MODE_SWITCH_ACK,
  DONT_TEXT_OPENING,
  getModeLabel,
  getModeById,
  getEntryChipLabel,
  getEntryModes,
} from '../../lib/parle/modes'
import {
  getChatArchives,
  getChatArchiveById,
  saveChatArchive,
  removeChatArchive,
  formatSessionListDate,
} from '../../lib/parle/chatArchives'
import { buildContextRecapBlock } from '../../lib/parle/prompts'

const CURRENT_SESSION_ID = 'current-live'

function buildConversationTitle(msgs) {
  const first = (msgs || []).find((m) => m.role === 'user')
  if (first?.text) {
    const trimmed = String(first.text).trim()
    return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed
  }
  return 'New conversation'
}

function formatSessionDate() {
  const raw = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const [month, day] = raw.split(' ')
  return `${month.toUpperCase()} ${day}`
}

function formatMessageTime(ts) {
  if (!ts) return null
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}


function SessionHeader() {
  return (
    <header className="text-center px-2 pt-2 pb-8 md:pb-10">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
        SESSION · {formatSessionDate()}
      </p>
      <h1 className="mt-4 font-serif text-[clamp(2rem,5vw,3rem)] leading-[1.15] text-foreground">
        A quiet place to talk.
      </h1>
      <p className="mt-3 text-[0.95rem] text-muted-foreground max-w-md mx-auto leading-relaxed">
        Whatever comes out is okay. No tracking, no transcripts shared.
      </p>
    </header>
  )
}

function EntryChip({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3.5 py-2 rounded-full border text-[13px] transition whitespace-nowrap',
        'border-border bg-card text-foreground/90',
        'hover:bg-rose/[0.08] hover:border-clay/35',
      )}
    >
      {children}
    </button>
  )
}

function EntryScreen({ returningOpening, onSelectMode }) {
  const entryModes = getEntryModes()

  return (
    <div className="pb-6">
      {returningOpening ? (
        <div className="mb-8">
          <Bubble msg={{ role: 'assistant', text: returningOpening, at: Date.now() }} />
        </div>
      ) : null}

      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground text-center">
        What do you need right now?
      </p>
      <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto text-center leading-relaxed">
        Comfort first. Advice when you&apos;re ready. You can change this anytime.
      </p>

      <div className="mt-5 flex flex-wrap gap-2 justify-center">
        {entryModes.map((mode) => (
          <EntryChip key={mode.id} onClick={() => onSelectMode(mode)}>
            {getEntryChipLabel(mode.id)}
          </EntryChip>
        ))}
      </div>
    </div>
  )
}

function Bubble({ msg }) {
  const isYou = msg.role === 'user'
  const time = formatMessageTime(msg.at)

  if (!isYou) {
    return (
      <article className="parle-chat-msg parle-chat-msg--assistant">
        <span className="parle-chat-msg__label">parlé</span>
        <p className="parle-chat-msg__body">{msg.text}</p>
        {time ? <time className="parle-chat-msg__time">{time}</time> : null}
      </article>
    )
  }

  return (
    <article className="parle-chat-msg parle-chat-msg--user">
      <div className="parle-chat-msg__bubble">{msg.text}</div>
      {time ? <time className="parle-chat-msg__time">{time}</time> : null}
    </article>
  )
}

function TypingIndicator() {
  return (
    <div className="parle-chat-msg parle-chat-msg--assistant parle-chat-msg--typing" aria-live="polite">
      <span className="parle-chat-msg__label">parlé</span>
      <div className="parle-chat-msg__typing-dots">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/45 animate-pulse" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/45 animate-pulse [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary/45 animate-pulse [animation-delay:300ms]" />
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
  const [imageAttachConsent, setImageAttachConsent] = useState(false)
  const [dontTextPhase, setDontTextPhase] = useState(null)
  const [hiddenInjections, setHiddenInjections] = useState([])
  const [isNewSession, setIsNewSession] = useState(true)
  const [user, setUser] = useState(null)
  const [serverSessions, setServerSessions] = useState([])
  const [sidebarSessions, setSidebarSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [archivesRevision, setArchivesRevision] = useState(0)
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
        setUser(authPayload?.user || null)

        if (authed) {
          track('chat_loaded', { authed: true })
          const [historyRes, contextRes, sessionsRes] = await Promise.all([
            fetch('/api/chat/history'),
            fetch('/api/chat/context'),
            fetch('/api/chat/sessions'),
          ])
          const rows = historyRes.ok ? await historyRes.json() : []
          const context = contextRes.ok ? await contextRes.json() : {}
          const sessionsPayload = sessionsRes.ok ? await sessionsRes.json() : []

          if (!active) return

          setServerSessions(Array.isArray(sessionsPayload) ? sessionsPayload : [])

          setMemoryEnabled(Boolean(context?.memory_enabled))
          setImageAttachConsent(Boolean(context?.image_attach_consent))

          const history = (rows || []).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            text: m.text,
            at: m.created_at ? new Date(m.created_at).getTime() : undefined,
          }))

          if (history.length > 0) {
            setMessages(history)
            setChatMode({ id: DEFAULT_MODE.id, ...DEFAULT_MODE })
            setIsNewSession(false)
            setActiveSessionId(CURRENT_SESSION_ID)
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
        setUser(null)
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

  useEffect(() => {
    if (messages === null) return

    const archives = getChatArchives()
    const archiveIds = new Set(archives.map((item) => item.id))
    const items = []
    const hasLiveConversation = visibleMessages.length > 0 || chatMode

    if (isAuthed && hasLiveConversation) {
      items.push({
        id: CURRENT_SESSION_ID,
        title: buildConversationTitle(visibleMessages),
        loadable: true,
        deletable: visibleMessages.length > 0,
      })
    }

    archives.forEach((archive) => {
      if (archive.id === sessionRef.current.sessionId && activeSessionId === CURRENT_SESSION_ID) {
        return
      }
      items.push({
        id: archive.id,
        title: archive.title,
        loadable: true,
        deletable: true,
      })
    })

    if (isAuthed) {
      serverSessions.forEach((session) => {
        if (archiveIds.has(session.session_id)) return
        if (
          session.session_id === sessionRef.current.sessionId &&
          activeSessionId === CURRENT_SESSION_ID
        ) {
          return
        }
        const archived = getChatArchiveById(session.session_id)
        items.push({
          id: session.session_id,
          title: archived?.title || formatSessionListDate(session.created_at),
          loadable: Boolean(archived),
        })
      })
    }

    setSidebarSessions(
      items.map(({ id, title, loadable, deletable }) => ({
        id,
        title,
        loadable,
        deletable: Boolean(deletable),
      })),
    )
  }, [messages, chatMode, visibleMessages, isAuthed, serverSessions, activeSessionId, archivesRevision])

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
    setActiveSessionId(CURRENT_SESSION_ID)

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
          { role: 'assistant', text: DONT_TEXT_OPENING, at: Date.now() },
        ])
        return
      }
      const ack = MODE_SWITCH_ACK[mode.id]
      if (ack) {
        setMessages((prev) => [...(prev || []), { role: 'assistant', text: ack, at: Date.now() }])
      }
      setDontTextPhase(null)
      return
    }

    if (mode.id === 'dont_text') {
      setDontTextPhase('awaiting_unsent')
      sessionRef.current.dontTextMessageCount = 0
      setMessages((prev) => {
        const base = prev?.length ? prev : []
        return [...base, { role: 'assistant', text: DONT_TEXT_OPENING, at: Date.now() }]
      })
    } else {
      setDontTextPhase(null)
    }

    track('entry_started', { style: mode.id })
  }

  function resolveMode() {
    return chatMode || { id: DEFAULT_MODE.id, ...DEFAULT_MODE }
  }

  async function send({ text: value, images = [] } = {}) {
    const v = String(value || '').trim()
    const imagePayload = Array.isArray(images) ? images.filter(Boolean).slice(0, 2) : []
    if ((!v && !imagePayload.length) || thinking) return

    let mode = resolveMode()
    if (!chatMode) {
      mode = { id: DEFAULT_MODE.id, ...DEFAULT_MODE }
      setChatMode(mode)
      setActiveSessionId(CURRENT_SESSION_ID)
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

    session.userMessages.push({ length: v.length || 0, sentAt: now, replyGapSeconds: replyGap })

    if (mode.id === 'dont_text') {
      session.dontTextMessageCount += 1
    }

    setText('')
    const displayText = v || (imagePayload.length ? '[Image attached]' : '')
    const nextMessages = [...(messages || []), { role: 'user', text: displayText, at: now }]
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
        images: imagePayload,
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...(prev || []), { role: 'assistant', text: data.reply, at: Date.now() }])
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
          { role: 'assistant', text: 'Sorry, something went wrong. Please try again.', at: Date.now() },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...(prev || []),
        { role: 'assistant', text: 'Sorry, something went wrong. Please try again.', at: Date.now() },
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

  async function resetToPreChat({ refreshOpening = false } = {}) {
    setMessages([])
    setChatMode(null)
    setQuoteRec(null)
    setGuestBannerDismissed(false)
    setDontTextPhase(null)
    setHiddenInjections([])
    setIsNewSession(true)
    setActiveSessionId(null)
    lastRecapAt.current = 0
    sessionRef.current = createSessionState()

    if (refreshOpening && isAuthed && memoryEnabled) {
      const openingRes = await fetch('/api/chat/returning-opening', { method: 'POST' })
      const openingPayload = openingRes.ok ? await openingRes.json() : {}
      if (openingPayload?.opening) {
        setReturningOpening(openingPayload.opening)
      } else {
        setReturningOpening(null)
      }
    } else if (refreshOpening) {
      setReturningOpening(null)
    }
  }

  async function clearChat() {
    if (thinking) return

    const currentMessages = messages || []
    if (currentMessages.length) {
      saveChatArchive({
        id: sessionRef.current.sessionId,
        title: buildConversationTitle(currentMessages),
        messages: currentMessages,
        chatModeId: chatMode?.id,
      })
    }

    await sendSessionEnd()

    if (isAuthed) {
      await fetch('/api/chat/clear', { method: 'POST' }).catch(() => null)
      const sessionsRes = await fetch('/api/chat/sessions')
      if (sessionsRes.ok) {
        const payload = await sessionsRes.json()
        setServerSessions(Array.isArray(payload) ? payload : [])
      }
    }

    await resetToPreChat({ refreshOpening: true })
    setArchivesRevision((n) => n + 1)

    track('chat_deleted', { authed: isAuthed })
  }

  async function handleDeleteSession(session, e) {
    e.preventDefault()
    e.stopPropagation()
    if (thinking || !session?.deletable) return

    if (session.id === CURRENT_SESSION_ID) {
      await sendSessionEnd()
      if (isAuthed) {
        await fetch('/api/chat/clear', { method: 'POST' }).catch(() => null)
        const sessionsRes = await fetch('/api/chat/sessions')
        if (sessionsRes.ok) {
          const payload = await sessionsRes.json()
          setServerSessions(Array.isArray(payload) ? payload : [])
        }
      }
      await resetToPreChat({ refreshOpening: true })
      setArchivesRevision((n) => n + 1)
      track('chat_deleted', { authed: isAuthed, source: 'sidebar' })
      return
    }

    removeChatArchive(session.id)
    setArchivesRevision((n) => n + 1)

    if (activeSessionId === session.id) {
      await resetToPreChat({ refreshOpening: false })
    }

    track('chat_deleted', { authed: isAuthed, source: 'sidebar_archive' })
  }

  async function handleSelectSession(session) {
    if (!session?.loadable || thinking) return

    if (session.id === CURRENT_SESSION_ID) {
      if (activeSessionId === CURRENT_SESSION_ID) {
        return
      }

      if (isAuthed) {
        const historyRes = await fetch('/api/chat/history')
        const rows = historyRes.ok ? await historyRes.json() : []
        const history = (rows || []).map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.text,
          at: m.created_at ? new Date(m.created_at).getTime() : undefined,
        }))
        setMessages(history)
        setChatMode(history.length ? { id: DEFAULT_MODE.id, ...DEFAULT_MODE } : null)
      }

      setActiveSessionId(CURRENT_SESSION_ID)
      return
    }

    const archive = getChatArchiveById(session.id)
    if (!archive) return

    await sendSessionEnd()

    setMessages(archive.messages)
    setChatMode(
      archive.chatModeId
        ? { id: archive.chatModeId, ...getModeById(archive.chatModeId) }
        : null,
    )
    setActiveSessionId(session.id)
    setQuoteRec(null)
    setGuestBannerDismissed(false)
    setDontTextPhase(null)
    setHiddenInjections([])
    setIsNewSession(false)
    sessionRef.current = createSessionState()
  }

  if (messages === null) {
    return null
  }

  const showEntry = !chatMode && !thinking
  const userMessageCount = visibleMessages.filter((m) => m.role === 'user').length
  const showGuestBanner =
    !isAuthed && !guestBannerDismissed && userMessageCount >= 10 && !showEntry
  const showDontTextLabel = chatMode?.id === 'dont_text' && !showEntry

  const resolvedActiveSessionId =
    activeSessionId ??
    (isAuthed && (visibleMessages.length > 0 || chatMode) ? CURRENT_SESSION_ID : null)

  return (
    <div className="parle-chat-layout">
      <ParleChatSidebar
        isAuthed={isAuthed}
        user={user}
        sessions={sidebarSessions}
        activeSessionId={resolvedActiveSessionId}
        mobileOpen={false}
        onCloseMobile={() => {}}
        onNewChat={clearChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <div className="parle-chat-main">
        <div ref={scrollRef} className="parle-chat-main__scroll">
          <div className="parle-chat-main__scroll-inner">
          <SessionHeader />

          {showEntry ? (
            <div className="parle-chat-main__entry">
              <EntryScreen
                returningOpening={returningOpening}
                onSelectMode={(mode) => startWithMode(mode)}
              />
            </div>
          ) : (
            <div className="parle-chat__messages">
              {visibleMessages.map((m, i) => (
                <Bubble key={`${m.role}-${i}-${m.text.slice(0, 8)}`} msg={m} />
              ))}
              {thinking && <TypingIndicator />}
            </div>
          )}

          {quoteRec && (
            <div className="mt-8 mb-4">
              <div className="rounded-2xl border border-border/80 bg-white/90 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
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
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-primary border border-transparent hover:bg-secondary',
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
            </div>
          )}
          </div>
        </div>

        <div className="parle-chat-main__bottom-fixed">
          <div className="parle-chat-main__bottom-inner">
            {showGuestBanner && (
              <div className="parle-chat__guest-banner">
                <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-white/80 px-4 py-3 text-sm max-w-xl mx-auto">
                  <p className="flex-1 text-muted-foreground leading-relaxed">
                    Your chat disappears when you leave. Create a free account to save it.{' '}
                    <Link
                      href="/register"
                      className="text-foreground underline underline-offset-2 hover:text-primary transition"
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
              </div>
            )}

            {showDontTextLabel && (
              <p className="mb-2 text-center text-[12px] text-muted-foreground px-4">
                Working through the urge to reach out
              </p>
            )}

            <ChatInputBar
              text={text}
              onTextChange={setText}
              onSend={send}
              disabled={thinking}
              activeModeId={chatMode?.id || DEFAULT_MODE.id}
              chatStarted={!showEntry}
              onModeChange={(mode) => startWithMode(mode, { isSwitch: Boolean(chatMode) })}
              isAuthed={isAuthed}
              imageConsentFromServer={imageAttachConsent}
            />

            <p className="parle-chat__disclaimer">
              <Lock size={11} strokeWidth={2} aria-hidden />
              <span>Private · Not a crisis service</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
