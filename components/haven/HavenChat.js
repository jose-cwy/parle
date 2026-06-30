import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Check, ChevronLeft, ChevronRight, CloudRain, Copy, Heart, Lock, MessageCircle, Pencil, RotateCcw, X } from 'lucide-react'
import { fetchAuthUser } from '../../lib/authSession'
import { cn } from '../../lib/cn'
import { pulseWarmth } from '../../lib/warmthPulse'
import { useTopProgress } from '../../lib/hooks/useTopProgress'
import { track } from '../../lib/events'
import ChatInputBar from './ChatInputBar'
import GuestConsentBanner from './GuestConsentBanner'
import {
  getChatReturnPath,
  navigateAwayFromChat,
} from '../../lib/parle/chatNavigation'
import ParleChatSidebar, {
  ParleChatMobileToolbar,
  ParleChatSidebarExpandButton,
} from './ParleChatSidebar'
import { ParleSettingsPopup } from './ParleSettings'
import {
  DEFAULT_MODE,
  MODE_SWITCH_ACK,
  STOP_CONTACT_OPENING,
  getModeLabel,
  getModeById,
  resolveModeId,
} from '../../lib/parle/modes'
import {
  getChatArchives,
  getChatArchiveById,
  saveChatArchive,
  removeChatArchive,
  renameChatArchive,
  uniquifyArchiveTitle,
  migrateLegacyArchiveTitles,
} from '../../lib/parle/chatArchives'
import {
  clearLiveSessionMeta,
  getPreferredModeId,
  loadLiveSessionMeta,
  saveLiveSessionMeta,
  setPreferredModeId,
} from '../../lib/parle/chatPreferences'
import { buildContextRecapBlock } from '../../lib/parle/prompts'
import { getGuestSessionToken, setGuestSessionToken } from '../../lib/parle/guestSessionToken'
import { parseBoldSegments } from '../../lib/parle/renderBoldText'

const CURRENT_SESSION_ID = 'current-live'
const SIDEBAR_COLLAPSED_KEY = 'parle-chat-sidebar-collapsed'
const LIVE_SESSION_TITLE = 'New Chat'

const EMPTY_STATE_QUICK_PROMPTS = [
  { text: 'I miss them', icon: Heart },
  { text: "I can't move on", icon: MessageCircle },
  { text: 'It really hurts right now', icon: CloudRain },
]

const MODE_ACK_TEXTS = new Set(
  Object.values(MODE_SWITCH_ACK).filter((value) => typeof value === 'string' && value),
)

function createMessageId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function cloneMessage(message) {
  return { ...message }
}

function isEphemeralAssistant(message) {
  if (!message || message.role !== 'assistant') return false
  if (message.ephemeral) return true
  if (message.text === STOP_CONTACT_OPENING) return true
  return MODE_ACK_TEXTS.has(message.text)
}

function countPersistedBefore(messages, index) {
  let count = 0
  for (let i = 0; i < index; i += 1) {
    const message = messages[i]
    if (message.role === 'user') count += 1
    else if (message.role === 'assistant' && !isEphemeralAssistant(message)) count += 1
  }
  return count
}

function toApiHistory(messages) {
  return (messages || [])
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && !isEphemeralAssistant(m)))
    .map((m) => ({ role: m.role, text: m.text }))
}

function createUserMessage(text, at = Date.now()) {
  return { id: createMessageId(), role: 'user', text, at }
}

function createAssistantMessage(text, { ephemeral = false, at = Date.now(), modeId } = {}) {
  return {
    id: createMessageId(),
    role: 'assistant',
    text,
    at,
    ...(ephemeral ? { ephemeral: true } : {}),
    ...(modeId ? { modeId: resolveModeId(modeId) } : {}),
  }
}

function createSystemNotice(text, at = Date.now()) {
  return {
    id: createMessageId(),
    role: 'system',
    text,
    at,
    ephemeral: true,
  }
}

function getGreetingDisplayName(user) {
  const raw = String(user?.preferred_name || '').trim()
  if (!raw) return null
  return raw
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function pickGreetingVariant(variants) {
  return variants[Math.floor(Math.random() * variants.length)]
}

function buildTimeGreeting(user, isAuthed) {
  const hour = new Date().getHours()
  const displayName = isAuthed ? getGreetingDisplayName(user) : null
  const nameSuffix = displayName ? `, ${displayName}` : ''

  if (hour >= 5 && hour < 12) {
    return pickGreetingVariant([
      `Good morning${nameSuffix}.`,
      `Morning${nameSuffix}.`,
      `Hey${nameSuffix}. Good morning.`,
    ])
  }
  if (hour >= 12 && hour < 18) {
    return pickGreetingVariant([
      `Hey${nameSuffix}. What's going on?`,
      `What's on your mind${nameSuffix}?`,
      `How's your day going${nameSuffix}?`,
    ])
  }
  if (hour >= 18 && hour < 22) {
    return pickGreetingVariant([
      `Hey${nameSuffix}. How's your evening?`,
      `How's tonight treating you${nameSuffix}?`,
      `What's going on tonight${nameSuffix}?`,
      `Feeling down${nameSuffix}?`,
    ])
  }
  return pickGreetingVariant([
    `Rough night${nameSuffix}?`,
    `Tough day${nameSuffix}?`,
    `Feeling down${nameSuffix}?`,
    `Still up${nameSuffix}?`,
    `Can't sleep${nameSuffix}?`,
  ])
}

function isDefaultSessionTitle(title) {
  return /^New Chat(\s\(\d+\))?$/.test(String(title || '').trim())
}

function hasUserMessages(msgs) {
  return (msgs || []).some((m) => m.role === 'user')
}

function isViewingArchive(activeSessionId) {
  return Boolean(
    activeSessionId &&
      activeSessionId !== CURRENT_SESSION_ID &&
      getChatArchiveById(activeSessionId),
  )
}

function isActiveLiveSession(activeSessionId) {
  return activeSessionId === CURRENT_SESSION_ID || activeSessionId == null
}

function shouldArchiveLiveChat(activeSessionId, currentMessages) {
  if (!hasUserMessages(currentMessages)) return false
  if (isViewingArchive(activeSessionId)) return false
  return isActiveLiveSession(activeSessionId)
}

function resolveSessionStorageKey(activeSessionId, sessionId) {
  if (activeSessionId && activeSessionId !== CURRENT_SESSION_ID) {
    return activeSessionId
  }
  return sessionId
}

function buildSidebarSessionList({ visibleMessages, activeSessionId, liveSessionTitle }) {
  const archives = getChatArchives()
  const items = []
  const hasUserMessageInLiveSession = hasUserMessages(visibleMessages)
  const viewingArchive = isViewingArchive(activeSessionId)
  const showLiveEntry =
    hasUserMessageInLiveSession && isActiveLiveSession(activeSessionId) && !viewingArchive

  archives.forEach((archive) => {
    if (!hasUserMessages(archive.messages)) return
    items.push({
      id: archive.id,
      title: archive.title,
      loadable: true,
      deletable: true,
      renamable: true,
    })
  })

  if (showLiveEntry) {
    items.unshift({
      id: CURRENT_SESSION_ID,
      title: liveSessionTitle,
      loadable: true,
      deletable: true,
      renamable: true,
    })
  }

  const seen = new Set()
  return items
    .filter(({ id }) => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    .map(({ id, title, loadable, deletable, renamable }) => ({
      id,
      title,
      loadable,
      deletable: Boolean(deletable),
      renamable: Boolean(renamable),
    }))
}

async function consumeChatStream(res, onUpdate) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const event of events) {
      const line = event.split('\n').find((entry) => entry.startsWith('data:'))
      if (!line) continue

      let payload
      try {
        payload = JSON.parse(line.slice(5).trim())
      } catch {
        continue
      }

      if (payload.delta) {
        reply += payload.delta
        onUpdate(reply)
      }
      if (payload.done) {
        reply = payload.reply || reply
        onUpdate(reply)
      }
    }
  }

  return reply
}

function splitAssistantParagraphs(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const parts = (/\n{2,}/.test(raw) ? raw.split(/\n{2,}/) : raw.split(/\n/))
    .map((part) => part.trim())
    .filter(Boolean)
  return parts
}

function renderParagraphContent(text) {
  return parseBoldSegments(text).map((segment, index) =>
    segment.type === 'bold' ? (
      <strong key={index}>{segment.value}</strong>
    ) : (
      segment.value
    ),
  )
}

function AssistantBody({ text }) {
  const paragraphs = splitAssistantParagraphs(text)

  if (!paragraphs.length) return null

  return (
    <div className="parle-chat-msg__body">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="parle-chat-msg__paragraph">
          {renderParagraphContent(paragraph)}
        </p>
      ))}
    </div>
  )
}

function UserMessageBubble({
  msg,
  messageIndex,
  disabled,
  onEdit,
  onResend,
  onBranchChange,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.text)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef(null)
  const copiedTimerRef = useRef(null)
  const branchCount = msg.branches?.length ?? 0
  const activeBranch = msg.activeBranch ?? Math.max(branchCount - 1, 0)
  const showBranchNav = branchCount > 1
  const canEdit = msg.text !== '[Image attached]'

  useEffect(() => {
    setDraft(msg.text)
  }, [msg.text])

  useEffect(() => {
    if (!editing || !textareaRef.current) return
    textareaRef.current.focus()
    const len = textareaRef.current.value.length
    textareaRef.current.setSelectionRange(len, len)
  }, [editing])

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  async function copyMessage() {
    const text = String(msg.text || '').trim()
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = text
        el.setAttribute('readonly', '')
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      } catch {
        return
      }
    }

    setCopied(true)
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  function startEdit() {
    setDraft(msg.text)
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(msg.text)
    setEditing(false)
  }

  function saveEdit() {
    const trimmed = String(draft || '').trim()
    if (!trimmed) return
    if (trimmed === msg.text) {
      setEditing(false)
      return
    }
    onEdit(messageIndex, trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <article className="parle-chat-msg parle-chat-msg--user parle-chat-msg--editing">
        <div className="parle-chat-msg__edit-wrap">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                saveEdit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                cancelEdit()
              }
            }}
            rows={3}
            className="parle-chat-msg__edit-input"
            aria-label="Edit message"
          />
          <div className="parle-chat-msg__edit-actions">
            <button
              type="button"
              onClick={cancelEdit}
              className="parle-chat-msg__action-btn"
              aria-label="Cancel edit"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={saveEdit}
              className="parle-chat-msg__action-btn parle-chat-msg__action-btn--primary"
              aria-label="Save edit"
            >
              <Check size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="parle-chat-msg parle-chat-msg--user">
      <div className="parle-chat-msg__bubble parle-chat-msg__bubble--user">{msg.text}</div>
      <div className="parle-chat-msg__user-actions">
        {showBranchNav && (
          <div className="parle-chat-msg__branch-nav" aria-label="Message versions">
            <button
              type="button"
              className="parle-chat-msg__action-btn"
              disabled={disabled || activeBranch <= 0}
              onClick={() => onBranchChange(messageIndex, activeBranch - 1)}
              aria-label="Previous version"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <span className="parle-chat-msg__branch-label">
              {activeBranch + 1}/{branchCount}
            </span>
            <button
              type="button"
              className="parle-chat-msg__action-btn"
              disabled={disabled || activeBranch >= branchCount - 1}
              onClick={() => onBranchChange(messageIndex, activeBranch + 1)}
              aria-label="Next version"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        )}
        <button
          type="button"
          className={cn(
            'parle-chat-msg__action-btn',
            copied && 'parle-chat-msg__action-btn--primary',
          )}
          onClick={copyMessage}
          disabled={disabled}
          aria-label={copied ? 'Copied' : 'Copy message'}
          title={copied ? 'Copied' : 'Copy'}
        >
          {copied ? (
            <Check size={15} strokeWidth={1.75} />
          ) : (
            <Copy size={15} strokeWidth={1.75} />
          )}
        </button>
        {canEdit && (
          <>
            <button
              type="button"
              className="parle-chat-msg__action-btn"
              disabled={disabled}
              onClick={() => onResend(messageIndex)}
              aria-label="Resend message"
              title="Resend"
            >
              <RotateCcw size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="parle-chat-msg__action-btn"
              disabled={disabled}
              onClick={startEdit}
              aria-label="Edit message"
              title="Edit"
            >
              <Pencil size={15} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </article>
  )
}

function Bubble({
  msg,
  messageIndex,
  thinking,
  onEditUserMessage,
  onResendUserMessage,
  onBranchChange,
}) {
  if (msg.role === 'user') {
    return (
      <UserMessageBubble
        msg={msg}
        messageIndex={messageIndex}
        disabled={thinking}
        onEdit={onEditUserMessage}
        onResend={onResendUserMessage}
        onBranchChange={onBranchChange}
      />
    )
  }

  if (msg.role === 'assistant') {
    return (
      <article className="parle-chat-msg parle-chat-msg--assistant">
        <AssistantBody text={msg.text} />
      </article>
    )
  }

  if (msg.role === 'system') {
    return (
      <p className="parle-chat-system-notice" role="status">
        {msg.text}
      </p>
    )
  }

  return null
}

function TypingIndicator() {
  return (
    <div
      className="parle-chat-msg parle-chat-msg--assistant parle-chat-msg--typing"
      role="status"
      aria-live="polite"
      aria-label="Thinking of a response"
    >
      <div className="parle-chat-msg__typing-dots">
        <span className="parle-chat-msg__typing-dot" />
        <span className="parle-chat-msg__typing-dot" />
        <span className="parle-chat-msg__typing-dot" />
      </div>
    </div>
  )
}

function EmptyStateQuickPrompts({ onSelect, disabled, exiting }) {
  return (
    <div
      className={cn(
        'parle-chat-empty-state__quick-prompts',
        exiting && 'parle-chat-empty-state__quick-prompts--exit',
      )}
      role="group"
      aria-label="Quick prompts"
    >
      {EMPTY_STATE_QUICK_PROMPTS.map(({ text, icon: Icon }) => (
        <button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(text)}
          className="parle-chat-empty-state__quick-prompt"
        >
          <span className="parle-chat-empty-state__quick-icon" aria-hidden>
            <Icon size={20} strokeWidth={1.6} />
          </span>
          <span className="parle-chat-empty-state__quick-label">{text}</span>
        </button>
      ))}
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
    stopContactMessageCount: 0,
    ended: false,
    titleAutoGenerated: false,
    titleManuallyRenamed: false,
    hasUserActivitySinceOpen: false,
  }
}

export default function HavenChat() {
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [text, setText] = useState('')
  const [loadingRevision, setLoadingRevision] = useState(0)
  const scrollRef = useRef(null)
  const [chatMode, setChatMode] = useState(null)
  const [isAuthed, setIsAuthed] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [returningOpening, setReturningOpening] = useState(null)
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false)
  const [imageAttachConsent, setImageAttachConsent] = useState(false)
  const [stopContactPhase, setStopContactPhase] = useState(null)
  const [hiddenInjections, setHiddenInjections] = useState([])
  const [isNewSession, setIsNewSession] = useState(true)
  const [user, setUser] = useState(null)
  const [sidebarSessions, setSidebarSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [archivesRevision, setArchivesRevision] = useState(0)
  const [liveSessionTitle, setLiveSessionTitle] = useState(LIVE_SESSION_TITLE)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingModeId, setPendingModeId] = useState(DEFAULT_MODE.id)
  const [entryExiting, setEntryExiting] = useState(false)
  const sessionRef = useRef(createSessionState())
  const lastRecapAt = useRef(0)
  const greetingPickRef = useRef(false)
  const [emptyGreeting, setEmptyGreeting] = useState('')
  const messagesRef = useRef(messages)
  const liveSessionTitleRef = useRef(LIVE_SESSION_TITLE)
  const activeSessionIdRef = useRef(activeSessionId)
  const loadingSessionsRef = useRef(new Set())
  messagesRef.current = messages
  liveSessionTitleRef.current = liveSessionTitle
  activeSessionIdRef.current = activeSessionId

  function getActiveStorageKey() {
    return resolveSessionStorageKey(activeSessionIdRef.current, sessionRef.current.sessionId)
  }

  function isViewingStorageKey(storageKey) {
    return getActiveStorageKey() === storageKey
  }

  function isActiveSessionLoading() {
    return loadingSessionsRef.current.has(getActiveStorageKey())
  }

  function isStorageKeyLoading(storageKey) {
    return loadingSessionsRef.current.has(storageKey)
  }

  function startSessionLoading(storageKey) {
    loadingSessionsRef.current.add(storageKey)
    setLoadingRevision((n) => n + 1)
  }

  function stopSessionLoading(storageKey) {
    if (!loadingSessionsRef.current.has(storageKey)) return
    loadingSessionsRef.current.delete(storageKey)
    setLoadingRevision((n) => n + 1)
  }

  function readMessagesForStorageKey(storageKey) {
    if (isViewingStorageKey(storageKey)) {
      return messagesRef.current || []
    }
    const archive = getChatArchiveById(storageKey)
    return archive?.messages || []
  }

  function commitMessages(storageKey, updater, { chatModeId, bumpOrder = false } = {}) {
    const prev = readMessagesForStorageKey(storageKey)
    const next = typeof updater === 'function' ? updater(prev) : updater
    const archive = getChatArchiveById(storageKey)

    if (archive && isAuthed) {
      saveChatArchive({
        id: storageKey,
        title: archive.title,
        messages: next
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map(cloneMessage),
        chatModeId: chatModeId || archive.chatModeId,
        bumpOrder,
      })
      setArchivesRevision((n) => n + 1)
    }

    if (isViewingStorageKey(storageKey)) {
      setMessages(next)
    }

    return next
  }

  const thinking = isActiveSessionLoading()
  void loadingRevision

  useTopProgress(historyLoading)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(max-width: 767px)')
    function sync() {
      if (!mq.matches) {
        document.body.classList.remove('body--chat-active')
        return
      }
      const hasUser = messages.some(
        (m) => m.role === 'user' && String(m.text || '').trim(),
      )
      document.body.classList.toggle('body--chat-active', hasUser || thinking)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => {
      mq.removeEventListener('change', sync)
      document.body.classList.remove('body--chat-active')
    }
  }, [messages, thinking])

  useEffect(() => {
    if (historyLoading) return
    if (hasUserMessages(messages)) {
      greetingPickRef.current = false
      return
    }
    if (greetingPickRef.current) return
    if (isAuthed && !user) return
    greetingPickRef.current = true
    setEmptyGreeting(buildTimeGreeting(user, isAuthed))
  }, [messages, user, isAuthed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      if (saved === 'true') setSidebarCollapsed(true)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const expandSidebar = useCallback(() => {
    setSidebarCollapsed(false)
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false')
    } catch {
      /* ignore */
    }
  }, [])

  const visibleMessages = useMemo(
    () => (messages || []).filter((m) => m.role === 'user' || m.role === 'assistant'),
    [messages],
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

    fetch('/api/chat/session-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
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
        const authUser = await fetchAuthUser({ force: true })
        if (!active) return

        const authed = Boolean(authUser)
        setIsAuthed(authed)
        setUser(authUser)

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
          setImageAttachConsent(Boolean(context?.image_attach_consent))

          const history = (rows || []).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            text: m.text,
            at: m.created_at ? new Date(m.created_at).getTime() : undefined,
          }))

          if (history.length > 0) {
            setMessages(history)
            setIsNewSession(false)
            setActiveSessionId(CURRENT_SESSION_ID)
            restoreLiveSessionFromMeta(loadLiveSessionMeta(), { history })
            setHistoryLoading(false)
            return
          }

          setMessages([])
          setPendingModeId(getPreferredModeId(DEFAULT_MODE.id))
          setHistoryLoading(false)

          if (context?.memory_enabled && context?.last_session_summary) {
            fetch('/api/chat/returning-opening', { method: 'POST' })
              .then((openingRes) => (openingRes.ok ? openingRes.json() : {}))
              .then((openingPayload) => {
                if (active && openingPayload?.opening) {
                  setReturningOpening(openingPayload.opening)
                }
              })
              .catch(() => {})
          }
          return
        }

        track('chat_loaded', { authed: false })
        setUser(null)
        setMessages([])
        setPendingModeId(getPreferredModeId(DEFAULT_MODE.id))
        setHistoryLoading(false)
      } catch {
        if (active) {
          setIsAuthed(false)
          setMessages([])
          setHistoryLoading(false)
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
    }
  }, [sendSessionEnd])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    if (historyLoading) return

    if (migrateLegacyArchiveTitles()) {
      setArchivesRevision((n) => n + 1)
    }

    setSidebarSessions(
      buildSidebarSessionList({
        visibleMessages,
        activeSessionId,
        liveSessionTitle,
      }),
    )
  }, [messages, chatMode, visibleMessages, isAuthed, activeSessionId, archivesRevision, liveSessionTitle])

  useEffect(() => {
    if (historyLoading) return
    if (!isAuthed) return
    if (!hasUserMessages(visibleMessages)) return
    if (isViewingArchive(activeSessionId)) return
    if (!isActiveLiveSession(activeSessionId)) return

    saveLiveSessionMeta({
      modeId: chatMode?.id || pendingModeId,
      title: liveSessionTitle,
      titleAutoGenerated: sessionRef.current.titleAutoGenerated,
      titleManuallyRenamed: sessionRef.current.titleManuallyRenamed,
    })
  }, [
    historyLoading,
    visibleMessages,
    activeSessionId,
    chatMode?.id,
    pendingModeId,
    liveSessionTitle,
    isAuthed,
  ])

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

  async function maybeAutoTitleSession(currentMessages) {
    const session = sessionRef.current
    if (session.titleAutoGenerated || session.titleManuallyRenamed) return
    if (!isDefaultSessionTitle(liveSessionTitleRef.current)) return

    const userCount = currentMessages.filter((m) => m.role === 'user').length
    const assistantCount = currentMessages.filter((m) => m.role === 'assistant').length
    if (userCount < 1 || assistantCount < 1) return

    session.titleAutoGenerated = true

    try {
      const res = await fetch('/api/chat/session-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages.slice(0, 6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      })
      if (!res.ok) {
        session.titleAutoGenerated = false
        return
      }

      const data = await res.json()
      const title = String(data?.title || '').trim().slice(0, 80)
      if (!title || session.titleManuallyRenamed) {
        session.titleAutoGenerated = false
        return
      }
      if (!isDefaultSessionTitle(liveSessionTitleRef.current)) return

      const nextTitle = uniquifyArchiveTitle(title, session.sessionId)
      setLiveSessionTitle(nextTitle)
      saveLiveSessionMeta({
        title: nextTitle,
        titleAutoGenerated: true,
        titleManuallyRenamed: false,
      })
      track('chat_title_auto', { authed: isAuthed })
    } catch {
      session.titleAutoGenerated = false
    }
  }

  function restoreLiveSessionFromMeta(meta, { history = null } = {}) {
    if (meta?.modeId) {
      const modeId = resolveModeId(meta.modeId)
      const mode = getModeById(modeId)
      setChatMode({ id: mode.id, style: mode.style, mood: mode.mood })
      setPendingModeId(mode.id)
      sessionRef.current.startingMode = mode.label
    } else if (history?.length) {
      const preferredId = getPreferredModeId(DEFAULT_MODE.id)
      const mode = getModeById(preferredId)
      setChatMode({ id: mode.id, style: mode.style, mood: mode.mood })
      setPendingModeId(mode.id)
      sessionRef.current.startingMode = mode.label
    }

    if (meta?.title && !isDefaultSessionTitle(meta.title)) {
      setLiveSessionTitle(meta.title)
      sessionRef.current.titleManuallyRenamed = Boolean(meta.titleManuallyRenamed)
      sessionRef.current.titleAutoGenerated = Boolean(meta.titleAutoGenerated)
    } else if (history?.length) {
      void maybeAutoTitleSession(history)
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
      if (mode.id === 'stop_contact') {
        setStopContactPhase('awaiting_unsent')
        sessionRef.current.stopContactMessageCount = 0
        setMessages((prev) => [
          ...(prev || []),
          createAssistantMessage(STOP_CONTACT_OPENING, {
            ephemeral: true,
            modeId: 'stop_contact',
          }),
        ])
        return
      }
      const ack = MODE_SWITCH_ACK[mode.id]
      if (ack) {
        setMessages((prev) => [
          ...(prev || []),
          createAssistantMessage(ack, { ephemeral: true, modeId: mode.id }),
        ])
      }
      setStopContactPhase(null)
      return
    }

    if (mode.id === 'stop_contact') {
      setStopContactPhase('awaiting_unsent')
      sessionRef.current.stopContactMessageCount = 0
      setMessages((prev) => {
        const base = prev?.length ? prev : []
        return [
          ...base,
          createAssistantMessage(STOP_CONTACT_OPENING, {
            ephemeral: true,
            modeId: 'stop_contact',
          }),
        ]
      })
    } else {
      setStopContactPhase(null)
    }

    track('entry_started', { style: mode.id })
  }

  function handleModeChange(mode) {
    if (isAuthed) {
      setPreferredModeId(mode.id)
    }
    const chatActive = hasUserMessages(messages || [])
    if (chatActive) {
      startWithMode(mode, { isSwitch: Boolean(chatMode) })
      if (isAuthed) {
        saveLiveSessionMeta({ modeId: mode.id })
      }
      return
    }
    setPendingModeId(mode.id)
  }

  function resolveMode() {
    return chatMode || { id: DEFAULT_MODE.id, ...DEFAULT_MODE }
  }

  function syncBranchTail(messageList, messageIndex) {
    const userMsg = messageList[messageIndex]
    if (!userMsg?.branches?.length) return messageList

    const active = userMsg.activeBranch ?? userMsg.branches.length - 1
    const branches = userMsg.branches.map((branch, index) =>
      index === active
        ? {
            text: userMsg.text,
            tail: messageList.slice(messageIndex + 1).map(cloneMessage),
          }
        : branch,
    )

    const next = [...messageList]
    next[messageIndex] = { ...userMsg, branches }
    return next
  }

  async function requestAssistantReply({
    userText,
    nextMessages,
    mode,
    dontTextStep,
    injections = hiddenInjections,
    images = [],
    isEdit = false,
    dbKeepCount,
    editMessageIndex,
    storageKey = getActiveStorageKey(),
  }) {
    const session = sessionRef.current
    const endpoint = isAuthed ? '/api/chat/send' : '/api/chat/guest-send'
    const body = {
      text: userText,
      modeId: mode.id,
      dontTextStep,
      dontTextMessageCount: session.stopContactMessageCount,
      hiddenInjections: injections,
      isNewSession: isAuthed && isNewSession && !isEdit,
      messages: toApiHistory(nextMessages.slice(0, -1)),
      images,
      ...(isEdit && isAuthed ? { isEdit: true, dbKeepCount } : {}),
      ...(!isAuthed ? { sessionToken: getGuestSessionToken() } : {}),
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!isAuthed) {
      const sessionHeader = res.headers.get('X-Parle-Guest-Session')
      if (sessionHeader) setGuestSessionToken(sessionHeader)
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (res.status === 429 || res.status === 400) {
        const notice =
          data?.message ||
          (res.status === 429 ? 'slow down a little.' : 'something went wrong with that message.')
        commitMessages(
          storageKey,
          (prev) => {
            const list = [...(prev || [])]
            if (list.length && list[list.length - 1]?.role === 'user') {
              list.pop()
            }
            return [...list, createSystemNotice(notice)]
          },
          { chatModeId: mode.id },
        )
        if (isViewingStorageKey(storageKey) && userText) {
          setText(userText)
        }
        return
      }

      commitMessages(storageKey, (prev) => [
        ...(prev || []),
        createAssistantMessage('Sorry, something went wrong. Please try again.', {
          modeId: mode.id,
        }),
      ], { chatModeId: mode.id })
      return
    }

    const contentType = res.headers.get('content-type') || ''
    const assistantAt = Date.now()

    if (contentType.includes('text/event-stream')) {
      commitMessages(storageKey, (prev) => [
        ...(prev || []),
        createAssistantMessage('', { at: assistantAt, modeId: mode.id }),
      ], { chatModeId: mode.id })

      const finalReply = await consumeChatStream(res, (replyText) => {
        commitMessages(storageKey, (prev) =>
          (prev || []).map((m) =>
            m.at === assistantAt ? { ...m, text: replyText, modeId: mode.id } : m,
          ),
        { chatModeId: mode.id })
      })

      const replyMessage = createAssistantMessage(finalReply || '', {
        at: assistantAt,
        modeId: mode.id,
      })
      const withReply = [...nextMessages, replyMessage]
      if (finalReply) {
        commitMessages(storageKey, (prev) => {
          const mapped = (prev || []).map((m) =>
            m.at === assistantAt ? { ...m, text: finalReply, modeId: mode.id } : m,
          )
          return isEdit && typeof editMessageIndex === 'number'
            ? syncBranchTail(mapped, editMessageIndex)
            : mapped
        }, { chatModeId: mode.id })
      } else if (isEdit && typeof editMessageIndex === 'number') {
        commitMessages(storageKey, (prev) => syncBranchTail(prev || [], editMessageIndex), {
          chatModeId: mode.id,
        })
      }

      session.lastAssistantAt = Date.now()
      if (isViewingStorageKey(storageKey)) {
        setIsNewSession(false)
        pulseWarmth(1, 1600)
        maybeAutoTitleSession(withReply)
      }
      track('chat_reply', { authed: isAuthed, safety: false, edit: isEdit })

      if (isAuthed && !isEdit && isViewingStorageKey(storageKey)) {
        await fetch('/api/gamification/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deltaChat: 1 }),
        }).catch(() => null)
      }
    } else {
      const data = await res.json()
      if (!isAuthed && data?.sessionToken) {
        setGuestSessionToken(data.sessionToken)
      }
      const replyMessage = createAssistantMessage(data.reply, {
        at: Date.now(),
        modeId: mode.id,
      })
      const withReply = [...nextMessages, replyMessage]
      commitMessages(storageKey, (prev) => {
        const merged = [...(prev || []), replyMessage]
        return isEdit && typeof editMessageIndex === 'number'
          ? syncBranchTail(merged, editMessageIndex)
          : merged
      }, { chatModeId: mode.id })
      session.lastAssistantAt = Date.now()
      if (isViewingStorageKey(storageKey)) {
        setIsNewSession(false)
        pulseWarmth(1, 1600)
        maybeAutoTitleSession(withReply)
      }
      track('chat_reply', { authed: isAuthed, safety: Boolean(data?.safety), edit: isEdit })

      if (isAuthed && !isEdit && isViewingStorageKey(storageKey)) {
        await fetch('/api/gamification/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deltaChat: 1 }),
        }).catch(() => null)
      }
    }
  }

  function switchMessageBranch(messageIndex, newBranchIndex) {
    if (isActiveSessionLoading()) return

    const prior = messages || []
    const target = prior[messageIndex]
    if (!target?.branches?.length) return
    if (newBranchIndex < 0 || newBranchIndex >= target.branches.length) return

    const branches = target.branches.map((branch) => ({
      text: branch.text,
      tail: branch.tail.map(cloneMessage),
    }))

    const currentActive = target.activeBranch ?? branches.length - 1
    const currentTail = prior.slice(messageIndex + 1).map(cloneMessage)
    branches[currentActive] = { text: target.text, tail: currentTail }

    const selected = branches[newBranchIndex]
    const updatedUser = {
      ...target,
      text: selected.text,
      branches,
      activeBranch: newBranchIndex,
    }

    setMessages([...prior.slice(0, messageIndex), updatedUser, ...selected.tail])
  }

  async function regenerateUserMessageReply(messageIndex, userText, { trackEvent = 'chat_edit' } = {}) {
    if (isActiveSessionLoading()) return

    const trimmed = String(userText || '').trim()
    if (!trimmed) return

    const prior = messages || []
    const target = prior[messageIndex]
    if (!target || target.role !== 'user') return
    if (target.text === '[Image attached]') return

    const mode = resolveMode()

    let branches = target.branches
      ? target.branches.map((branch) => ({
          text: branch.text,
          tail: branch.tail.map(cloneMessage),
        }))
      : []

    const activeIdx = target.activeBranch ?? (branches.length ? branches.length - 1 : -1)
    const currentTail = prior.slice(messageIndex + 1).map(cloneMessage)

    if (branches.length === 0) {
      branches.push({ text: target.text, tail: currentTail })
    } else if (activeIdx >= 0) {
      branches[activeIdx] = { text: target.text, tail: currentTail }
    }

    branches.push({ text: trimmed, tail: [] })
    const newActiveBranch = branches.length - 1
    const updatedUser = {
      ...target,
      text: trimmed,
      branches,
      activeBranch: newActiveBranch,
    }

    const truncated = [...prior.slice(0, messageIndex), updatedUser]
    setMessages(truncated)
    const storageKey = getActiveStorageKey()
    startSessionLoading(storageKey)

    const dbKeepCount = countPersistedBefore(prior, messageIndex)

    await checkRepeatSentiment(truncated)
    const newRecap = await maybeGenerateRecap(truncated, mode.id)
    const injections = newRecap ? [...hiddenInjections, newRecap] : hiddenInjections

    let dontTextStep = null
    if (mode.id === 'stop_contact') {
      dontTextStep = 'processing'
    }

    try {
      track(trackEvent, { authed: isAuthed, mode: mode.id })
      await requestAssistantReply({
        userText: trimmed,
        nextMessages: truncated,
        mode,
        dontTextStep,
        injections,
        isEdit: true,
        dbKeepCount,
        editMessageIndex: messageIndex,
        storageKey,
      })
    } catch {
      commitMessages(storageKey, (prev) => [
        ...(prev || []),
        createAssistantMessage('Sorry, something went wrong. Please try again.', {
          modeId: mode.id,
        }),
      ], { chatModeId: mode.id })
    } finally {
      stopSessionLoading(storageKey)
    }
  }

  async function editUserMessage(messageIndex, newText) {
    const trimmed = String(newText || '').trim()
    if (!trimmed) return

    const prior = messages || []
    const target = prior[messageIndex]
    if (!target || target.role !== 'user') return
    if (trimmed === target.text) return

    await regenerateUserMessageReply(messageIndex, trimmed, { trackEvent: 'chat_edit' })
  }

  async function resendUserMessage(messageIndex) {
    const prior = messages || []
    const target = prior[messageIndex]
    if (!target || target.role !== 'user') return

    await regenerateUserMessageReply(messageIndex, target.text, { trackEvent: 'chat_resend' })
  }

  async function send({ text: value, images = [] } = {}) {
    const v = String(value || '').trim()
    const imagePayload = Array.isArray(images) ? images.filter(Boolean).slice(0, 2) : []
    if ((!v && !imagePayload.length) || isActiveSessionLoading()) return

    let mode = resolveMode()
    let activeStopContactPhase = stopContactPhase
    if (!chatMode) {
      const selectedMode = getModeById(pendingModeId)
      mode = { id: selectedMode.id, style: selectedMode.style, mood: selectedMode.mood }
      setChatMode(mode)
      if (isAuthed) {
        setPreferredModeId(mode.id)
      }
      setActiveSessionId(CURRENT_SESSION_ID)
      if (!sessionRef.current.startingMode) {
        sessionRef.current.startingMode = selectedMode.label
      }
      if (mode.id === 'stop_contact') {
        activeStopContactPhase = 'awaiting_unsent'
        setStopContactPhase('awaiting_unsent')
        sessionRef.current.stopContactMessageCount = 0
      } else {
        setStopContactPhase(null)
      }
      track('entry_started', { style: mode.id })
    }

    if (!hasUserMessages(messages || [])) {
      setEntryExiting(true)
      window.setTimeout(() => setEntryExiting(false), 200)
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
    session.hasUserActivitySinceOpen = true

    if (mode.id === 'stop_contact') {
      session.stopContactMessageCount += 1
    }

    setText('')
    const displayText = v || (imagePayload.length ? '[Image attached]' : '')
    const priorMessages = messages || []
    const hasStopContactOpening = priorMessages.some(
      (m) => m.role === 'assistant' && m.text === STOP_CONTACT_OPENING,
    )
    let nextMessages
    if (mode.id === 'stop_contact' && !hasStopContactOpening && activeStopContactPhase === 'awaiting_unsent') {
      nextMessages = [
        ...priorMessages,
        createAssistantMessage(STOP_CONTACT_OPENING, {
          ephemeral: true,
          modeId: 'stop_contact',
          at: now - 1,
        }),
        createUserMessage(displayText, now),
      ]
    } else {
      nextMessages = [...priorMessages, createUserMessage(displayText, now)]
    }
    setMessages(nextMessages)
    const storageKey = getActiveStorageKey()
    startSessionLoading(storageKey)

    if (isViewingArchive(activeSessionId) && isAuthed) {
      const existing = getChatArchiveById(activeSessionId)
      if (existing) {
        saveChatArchive({
          id: activeSessionId,
          title: existing.title,
          messages: nextMessages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map(cloneMessage),
          chatModeId: mode.id || existing.chatModeId,
          bumpOrder: true,
        })
        setArchivesRevision((n) => n + 1)
      }
    }

    await checkRepeatSentiment(nextMessages)
    const newRecap = await maybeGenerateRecap(nextMessages, mode.id)
    const injections = newRecap ? [...hiddenInjections, newRecap] : hiddenInjections

    let dontTextStep = null
    if (mode.id === 'stop_contact') {
      if (activeStopContactPhase === 'awaiting_unsent') {
        dontTextStep = 'after_unsent'
        setStopContactPhase('processing')
      } else {
        dontTextStep = 'processing'
      }
    }

    try {
      track('chat_send', { authed: isAuthed, mode: mode.id })
      await requestAssistantReply({
        userText: v,
        nextMessages,
        mode,
        dontTextStep,
        injections,
        images: imagePayload,
        storageKey,
      })
    } catch {
      commitMessages(storageKey, (prev) => [
        ...(prev || []),
        createAssistantMessage('Sorry, something went wrong. Please try again.', {
          modeId: mode.id,
        }),
      ], { chatModeId: mode.id })
    } finally {
      stopSessionLoading(storageKey)
    }
  }

  async function refreshReturningOpening() {
    if (!isAuthed || !memoryEnabled) {
      setReturningOpening(null)
      return
    }
    try {
      const openingRes = await fetch('/api/chat/returning-opening', { method: 'POST' })
      const openingPayload = openingRes.ok ? await openingRes.json() : {}
      if (openingPayload?.opening) {
        setReturningOpening(openingPayload.opening)
      } else {
        setReturningOpening(null)
      }
    } catch {
      setReturningOpening(null)
    }
  }

  function resetToPreChatSync() {
    setMessages([])
    setChatMode(null)
    setPendingModeId(getPreferredModeId(DEFAULT_MODE.id))
    clearLiveSessionMeta()
    setEntryExiting(false)
    setGuestBannerDismissed(false)
    setStopContactPhase(null)
    setHiddenInjections([])
    setIsNewSession(true)
    setActiveSessionId(null)
    setLiveSessionTitle(LIVE_SESSION_TITLE)
    setReturningOpening(null)
    lastRecapAt.current = 0
    greetingPickRef.current = false
    setEmptyGreeting('')
    sessionRef.current = createSessionState()
  }

  function captureSessionSnapshot() {
    const session = sessionRef.current
    const currentMessages = (messages || []).filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    )
    return {
      sessionId: session.sessionId,
      ended: session.ended,
      userMessages: session.userMessages,
      startedAt: session.startedAt,
      modeSwitchCount: session.modeSwitchCount,
      startingMode: session.startingMode,
      silenceAfterResponseCount: session.silenceAfterResponseCount,
      repeatSentimentDetected: session.repeatSentimentDetected,
      messages: currentMessages,
      chatModeId: chatMode?.id,
    }
  }

  async function finalizePreviousSession(snapshot) {
    if (!snapshot) return

    const {
      sessionId,
      ended,
      userMessages,
      startedAt,
      modeSwitchCount,
      startingMode,
      silenceAfterResponseCount,
      repeatSentimentDetected,
      messages: currentMessages,
      chatModeId,
    } = snapshot

    if (isAuthed && !ended && (userMessages.length || currentMessages.length)) {
      const avgLen = userMessages.length
        ? Math.round(userMessages.reduce((a, m) => a + m.length, 0) / userMessages.length)
        : 0
      const avgGap = userMessages.length
        ? Math.round(userMessages.reduce((a, m) => a + (m.replyGapSeconds || 0), 0) / userMessages.length)
        : 0
      const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000))
      const transcript = currentMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n')

      await fetch('/api/chat/session-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message_count: currentMessages.length,
          user_avg_message_length: avgLen,
          avg_reply_gap_seconds: avgGap,
          mode_switches: modeSwitchCount,
          starting_mode: startingMode || getModeLabel(chatModeId),
          final_mode: getModeLabel(chatModeId),
          silence_after_response_count: silenceAfterResponseCount,
          repeat_sentiment_detected: repeatSentimentDetected,
          session_length_minutes: durationMin,
          transcript,
        }),
      }).catch(() => null)
    }

    if (isAuthed) {
      await fetch('/api/chat/clear', { method: 'POST' }).catch(() => null)
    }
  }

  async function clearChat() {
    if (isActiveSessionLoading()) return

    const currentMessages = messages || []
    const shouldArchive = shouldArchiveLiveChat(activeSessionId, currentMessages)
    const snapshot = shouldArchive ? captureSessionSnapshot() : null
    const shouldClearServer =
      isAuthed && isActiveLiveSession(activeSessionId) && !isViewingArchive(activeSessionId)

    if (snapshot && isAuthed) {
      const archiveId = snapshot.sessionId
      saveChatArchive({
        id: archiveId,
        title: uniquifyArchiveTitle(
          liveSessionTitle.trim() || LIVE_SESSION_TITLE,
          archiveId,
        ),
        messages: currentMessages.map(cloneMessage),
        chatModeId: chatMode?.id,
        bumpOrder: sessionRef.current.hasUserActivitySinceOpen,
      })
    }

    resetToPreChatSync()
    setArchivesRevision((n) => n + 1)

    if (snapshot) {
      void finalizePreviousSession(snapshot)
    } else if (shouldClearServer) {
      void fetch('/api/chat/clear', { method: 'POST' }).catch(() => null)
    }

    track('chat_deleted', { authed: isAuthed })
    await refreshReturningOpening()
  }

  function handleDeleteSession(session, e) {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!session?.deletable) return
    const deleteKey =
      session.id === CURRENT_SESSION_ID
        ? resolveSessionStorageKey(CURRENT_SESSION_ID, sessionRef.current.sessionId)
        : session.id
    if (isStorageKeyLoading(deleteKey)) return

    if (session.id === CURRENT_SESSION_ID) {
      const snapshot = hasUserMessages(messages || []) ? captureSessionSnapshot() : null

      resetToPreChatSync()
      setArchivesRevision((n) => n + 1)
      track('chat_deleted', { authed: isAuthed, source: 'sidebar' })

      void (async () => {
        if (snapshot) {
          await finalizePreviousSession(snapshot)
        } else if (isAuthed) {
          await fetch('/api/chat/clear', { method: 'POST' }).catch(() => null)
        }
        await refreshReturningOpening()
      })()
      return
    }

    removeChatArchive(session.id)
    setArchivesRevision((n) => n + 1)

    if (activeSessionId === session.id) {
      resetToPreChatSync()
    }

    track('chat_deleted', { authed: isAuthed, source: 'sidebar_archive' })
  }

  function handleRenameSession(session, newTitle) {
    if (!session?.renamable) return false
    const trimmed = String(newTitle || '').trim().slice(0, 80)
    if (!trimmed) return false

    if (session.id === CURRENT_SESSION_ID) {
      sessionRef.current.titleManuallyRenamed = true
      sessionRef.current.titleAutoGenerated = false
      setLiveSessionTitle(trimmed)
      saveLiveSessionMeta({
        title: trimmed,
        titleManuallyRenamed: true,
        titleAutoGenerated: false,
      })
      return true
    }

    const ok = renameChatArchive(session.id, trimmed)
    if (ok) setArchivesRevision((n) => n + 1)
    return ok
  }

  function persistSessionBeforeSwitch(targetSessionId) {
    if (targetSessionId === activeSessionId) return null
    if (!isAuthed) return null

    const currentMessages = (messages || []).filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    )
    if (!hasUserMessages(currentMessages)) return null

    if (shouldArchiveLiveChat(activeSessionId, currentMessages)) {
      const archiveId = sessionRef.current.sessionId
      saveChatArchive({
        id: archiveId,
        title: uniquifyArchiveTitle(
          liveSessionTitle.trim() || LIVE_SESSION_TITLE,
          archiveId,
        ),
        messages: currentMessages.map(cloneMessage),
        chatModeId: chatMode?.id,
        bumpOrder: sessionRef.current.hasUserActivitySinceOpen,
      })
      const snapshot = captureSessionSnapshot()
      clearLiveSessionMeta()
      return { type: 'live', snapshot }
    }

    if (isViewingArchive(activeSessionId)) {
      const existing = getChatArchiveById(activeSessionId)
      if (existing) {
        saveChatArchive({
          id: activeSessionId,
          title: existing.title,
          messages: currentMessages.map(cloneMessage),
          chatModeId: chatMode?.id || existing.chatModeId,
          bumpOrder: false,
        })
        return { type: 'archive' }
      }
    }

    return null
  }

  async function handleSelectSession(session) {
    if (!session?.loadable) return
    if (session.id === activeSessionId) return

    const parked = persistSessionBeforeSwitch(session.id)
    if (parked) {
      setArchivesRevision((n) => n + 1)
      if (parked.type === 'live' && parked.snapshot) {
        void finalizePreviousSession(parked.snapshot)
      }
    }

    if (session.id === CURRENT_SESSION_ID) {
      if (isAuthed) {
        const historyRes = await fetch('/api/chat/history')
        const rows = historyRes.ok ? await historyRes.json() : []
        const history = (rows || []).map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          text: m.text,
          at: m.created_at ? new Date(m.created_at).getTime() : undefined,
        }))
        setMessages(history)
        if (history.length) {
          restoreLiveSessionFromMeta(loadLiveSessionMeta(), { history })
        } else {
          setChatMode(null)
        }
      }

      setActiveSessionId(CURRENT_SESSION_ID)
      return
    }

    const archive = getChatArchiveById(session.id)
    if (!archive) return

    if (parked?.type !== 'live') {
      await sendSessionEnd()
    }

    setMessages(archive.messages)
    setChatMode(
      archive.chatModeId
        ? { id: archive.chatModeId, ...getModeById(archive.chatModeId) }
        : null,
    )
    setActiveSessionId(session.id)
    setGuestBannerDismissed(false)
    setStopContactPhase(null)
    setHiddenInjections([])
    setIsNewSession(false)
    sessionRef.current = createSessionState()
  }

  const hasLiveUserMessages = hasUserMessages(visibleMessages)
  const chatActive = hasLiveUserMessages || thinking
  const showEmptyUI = entryExiting || (!hasLiveUserMessages && !thinking)
  const userMessageCount = visibleMessages.filter((m) => m.role === 'user').length
  const showGuestBanner =
    !isAuthed && !guestBannerDismissed && userMessageCount >= 10 && chatActive
  const showStopContactLabel = chatMode?.id === 'stop_contact' && chatActive
  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1]
  const showTypingIndicator =
    thinking &&
    (!lastVisibleMessage ||
      lastVisibleMessage.role === 'user' ||
      (lastVisibleMessage.role === 'assistant' && !String(lastVisibleMessage.text || '').trim()))

  const isLiveSession = isActiveLiveSession(activeSessionId) && !isViewingArchive(activeSessionId)

  const resolvedActiveSessionId =
    activeSessionId ??
    (hasLiveUserMessages && isLiveSession ? CURRENT_SESSION_ID : null)

  return (
    <div
      className={cn(
        'parle-chat-layout',
        sidebarCollapsed && 'parle-chat-layout--sidebar-collapsed',
        showEmptyUI && 'parle-chat-layout--empty',
      )}
    >
      <ParleChatSidebar
        isAuthed={isAuthed}
        user={user}
        sessions={sidebarSessions}
        activeSessionId={resolvedActiveSessionId}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onToggleCollapse={toggleSidebarCollapsed}
        onNewChat={clearChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <ParleSettingsPopup
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isAuthed={isAuthed}
      />

      <div className="parle-chat-main">
        <ParleChatMobileToolbar onOpenHistory={() => setMobileSidebarOpen(true)} />
        {sidebarCollapsed ? (
          <ParleChatSidebarExpandButton onClick={expandSidebar} />
        ) : null}

        <div ref={scrollRef} className="parle-chat-main__scroll">
          <div className="parle-chat-main__scroll-inner">
          {!hasLiveUserMessages && returningOpening ? (
            <div className="parle-chat__messages">
              <Bubble
                msg={{
                  role: 'assistant',
                  text: returningOpening,
                  at: Date.now(),
                  modeId: 'emotional',
                }}
              />
            </div>
          ) : chatActive ? (
            <div className="parle-chat__messages">
              {(messages || []).map((m, i) => {
                if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') {
                  return null
                }
                if (
                  m.role === 'assistant' &&
                  showTypingIndicator &&
                  !String(m.text || '').trim()
                ) {
                  return null
                }
                return (
                  <Bubble
                    key={m.id || `${m.role}-${i}-${m.text.slice(0, 8)}`}
                    msg={m}
                    messageIndex={i}
                    thinking={thinking}
                    onEditUserMessage={editUserMessage}
                    onResendUserMessage={resendUserMessage}
                    onBranchChange={switchMessageBranch}
                  />
                )
              })}
              {showTypingIndicator && <TypingIndicator />}
            </div>
          ) : null}

          </div>
        </div>

        {showEmptyUI && (
          <div className="parle-chat-empty-state">
            <h1
              className={cn(
                'parle-chat-empty-state__greeting',
                entryExiting && 'parle-chat-empty-state__greeting--exit',
              )}
            >
              {emptyGreeting}
            </h1>

            <div className="parle-chat-empty-state__input parle-chat-empty-state__input--center">
              <ChatInputBar
                text={text}
                onTextChange={setText}
                onSend={send}
                disabled={thinking}
                loading={thinking}
                activeModeId={chatMode?.id || pendingModeId}
                onModeChange={handleModeChange}
                isAuthed={isAuthed}
                imageConsentFromServer={imageAttachConsent}
              />
            </div>

            <EmptyStateQuickPrompts
              onSelect={(prompt) => send({ text: prompt })}
              disabled={thinking}
              exiting={entryExiting}
            />
          </div>
        )}

        <div className="parle-chat-main__bottom-fixed">
          {!isAuthed && <GuestConsentBanner visible />}
          <div className="parle-chat-main__bottom-inner">
            {!showEmptyUI && showGuestBanner && (
              <div className="parle-chat__guest-banner">
                <div className="flex items-start gap-3 rounded-2xl border border-border/80 bg-card/90 px-4 py-3 text-[12px] max-w-xl mx-auto">
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

            {!showEmptyUI && showStopContactLabel && (
              <p className="mb-2 text-center text-[10px] text-muted-foreground px-4">
                Working through the urge to reach out
              </p>
            )}

            <div
              className={cn(
                'parle-chat-main__bottom-input',
                showEmptyUI && 'parle-chat-main__bottom-input--empty-mobile',
              )}
            >
              <ChatInputBar
                text={text}
                onTextChange={setText}
                onSend={send}
                disabled={thinking}
                loading={thinking}
                activeModeId={chatMode?.id || pendingModeId}
                onModeChange={handleModeChange}
                isAuthed={isAuthed}
                imageConsentFromServer={imageAttachConsent}
              />
            </div>

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
