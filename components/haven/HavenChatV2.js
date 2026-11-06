import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Check, ChevronLeft, ChevronRight, Clock, CloudRain, Copy, Heart, Lock, MessageCircle, MoreHorizontal, Pencil, RotateCcw, X } from 'lucide-react'
import { fetchAuthUser } from '../../lib/authSession'
import { cn } from '../../lib/cn'
import { pulseWarmth } from '../../lib/warmthPulse'
import { useTopProgress } from '../../lib/hooks/useTopProgress'
import { track } from '../../lib/events'
import ChatInputBar, { ChatComposerProvider } from './ChatInputBar'
import GuestConsentBanner from './GuestConsentBanner'
import MessageFeedbackActions from './MessageFeedbackActions'
import ProductPulseCard, {
  markOutcomeSurveyShownToday,
  wasOutcomeSurveyShownToday,
} from './ProductPulseCard'
import surveyEnding from '../../lib/parle/surveyEnding'
import {
  getChatReturnPath,
  navigateAwayFromChat,
} from '../../lib/parle/chatNavigation'
import ParleChatSidebar, {
  ParleChatMobileToolbar,
  ParleChatSidebarExpandButton,
} from './ParleChatSidebarV2'
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
  pruneArchivesMatchingMessages,
  isArchiveDeleted,
} from '../../lib/parle/chatArchives'
import { shouldIgnoreCommit } from '../../lib/parle/sessionCommit'
import {
  listConversations,
  listLegacyHistory,
  createConversation,
  getConversation,
  postConversationMessage,
  archiveConversation as archiveConversationRequest,
  restoreConversation as restoreConversationRequest,
  mergeLegacyPages,
  readConversationIdFromUrl,
  loadStoredConversationId,
  resolveConversationSelection,
  shouldApplyBootstrappedConversation,
  resolveActiveConversationRef,
  saveSelectedConversationId,
  loadConversationTitles,
  saveConversationTitle,
  mapConversationMessages,
} from '../../lib/parle/conversationClient'
import {
  clearLiveSessionMeta,
  getPreferredModeId,
  loadLiveSessionMeta,
  saveLiveSessionMeta,
  setChatLocalUserId,
  setPreferredModeId,
} from '../../lib/parle/chatPreferences'
import OnboardingSheet from './OnboardingSheet'
import {
  getGuestOnboardingReason,
  isGuestOnboardingAnswered,
  saveGuestOnboarding,
} from '../../lib/parle/onboarding'
import { getGuestSessionToken, setGuestSessionToken, clearGuestSessionToken } from '../../lib/parle/guestSessionToken'
import {
  saveGuestChatDraft,
  loadGuestChatDraft,
  clearGuestChatDraft,
  guestDraftHasUserMessages,
} from '../../lib/parle/guestChatDraft'
import { parseBoldSegments } from '../../lib/parle/renderBoldText'
import {
  createAnimationFrameBatcher,
  createThrottledRunner,
  isNearBottom,
  patchStreamingAssistantMessage,
} from '../../lib/parle/chatUiPerf'

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

function mapServerHistory(rows) {
  return (rows || []).map((m) => ({
    id: m.id != null ? String(m.id) : createMessageId(),
    role: m.role === 'user' ? 'user' : 'assistant',
    text: m.text,
    at: m.created_at ? new Date(m.created_at).getTime() : undefined,
  }))
}

function toApiHistory(messages) {
  return (messages || [])
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && !isEphemeralAssistant(m)))
    .map((m) => ({ role: m.role, text: m.text }))
}

function createUserMessage(text, at = Date.now()) {
  return { id: createMessageId(), role: 'user', text, at }
}

function createAssistantMessage(text, { ephemeral = false, at = Date.now(), modeId, id } = {}) {
  return {
    id: id || createMessageId(),
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

function parseGuestUsageRemaining(res, data) {
  const header = res?.headers?.get?.('X-Parle-Usage-Remaining')
  if (header != null && header !== '') {
    const remaining = Number(header)
    if (Number.isFinite(remaining)) return Math.max(0, remaining)
  }
  if (data?.error === 'daily_limit_reached') {
    const remaining = Number(data.remaining)
    return Number.isFinite(remaining) ? Math.max(0, remaining) : 0
  }
  if (data?.remaining != null) {
    const remaining = Number(data.remaining)
    if (Number.isFinite(remaining)) return Math.max(0, remaining)
  }
  return null
}

function formatGuestUsageResetTime() {
  // TEMP: keep in sync with GUEST_LIMIT_WINDOW_MS in lib/usageTracking.js
  const windowMs = 4 * 60 * 60 * 1000
  const reset = new Date((Math.floor(Date.now() / windowMs) + 1) * windowMs)
  return reset.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function GuestUsageHint({ remaining }) {
  if (remaining == null || remaining <= 0 || remaining > 5) return null

  return (
    <div className="parle-chat__composer-notice" role="status">
      <div className="parle-chat__composer-notice-bar">
        <p className="parle-chat__composer-notice-text">
          {remaining} {remaining === 1 ? 'message' : 'messages'} left until {formatGuestUsageResetTime()}. Don&apos;t end the conversation here.
        </p>
        <Link href="/register" className="parle-chat__composer-notice-action">
          Sign up
        </Link>
      </div>
    </div>
  )
}

function GuestLimitBlock() {
  return (
    <div className="parle-chat__input-wrap">
      <div className="parle-chat__composer-lock" role="status" aria-live="polite">
        <Clock
          size={16}
          strokeWidth={1.75}
          className="parle-chat__composer-lock-icon"
          aria-hidden
        />
        <p className="parle-chat__composer-lock-text">
          Your free messages return at {formatGuestUsageResetTime()}.
        </p>
        <Link href="/register" className="parle-chat__composer-lock-action">
          Sign up
        </Link>
      </div>
    </div>
  )
}

function buildSidebarSessionList({
  visibleMessages,
  activeSessionId,
  liveSessionTitle,
  isAuthed,
  serverConversations,
  conversationTitles,
}) {
  if (isAuthed) {
    return (serverConversations || []).map((row) => ({
      id: row.id,
      title:
        conversationTitles?.[row.id]
        || row.title
        || liveSessionTitle
        || LIVE_SESSION_TITLE,
      loadable: true,
      deletable: false,
      archivable: true,
      renamable: false,
    }))
  }
  const archives = []
  const items = []
  const hasUserMessageInLiveSession = hasUserMessages(visibleMessages)
  const viewingArchive = isViewingArchive(activeSessionId)
  const showLiveEntry =
    hasUserMessageInLiveSession && isActiveLiveSession(activeSessionId) && !viewingArchive

  archives.forEach((archive) => {
    if (isArchiveDeleted(archive.id)) return
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
    .map(({ id, title, loadable, deletable, archivable, renamable }) => ({
      id,
      title,
      loadable,
      deletable: Boolean(deletable),
      archivable: Boolean(archivable),
      renamable: Boolean(renamable),
    }))
}

async function consumeChatStream(res, onUpdate, signal) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let reply = ''

  const abortError = () => {
    const error = new Error('Aborted')
    error.name = 'AbortError'
    return error
  }

  try {
    if (signal?.aborted) throw abortError()

    while (true) {
      if (signal?.aborted) throw abortError()
      const { done, value } = await reader.read()
      if (signal?.aborted) throw abortError()
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

        if (payload.error && !payload.delta && !payload.reply) {
          const error = new Error(String(payload.error))
          error.code = payload.error
          error.recoverable = true
          throw error
        }
        if (payload.delta) {
          reply += payload.delta
          onUpdate(reply)
        }
        if (payload.done) {
          reply = payload.reply || reply
          onUpdate(reply, payload)
        }
      }
    }

    return reply
  } finally {
    if (signal?.aborted) {
      try {
        await reader.cancel()
      } catch {
        /* ignore */
      }
    }
  }
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
  compactActions = false,
  onEdit,
  onResend,
  onBranchChange,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.text)
  const [copied, setCopied] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const textareaRef = useRef(null)
  const copiedTimerRef = useRef(null)
  const branchCount = msg.branches?.length ?? 0
  const activeBranch = msg.activeBranch ?? Math.max(branchCount - 1, 0)
  const showBranchNav = branchCount > 1
  const canEdit = Boolean(onEdit) && Boolean(onResend) && msg.text !== '[Image attached]'

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
        {compactActions && !showBranchNav ? (
          <button
            type="button"
            className="parle-chat-msg__action-btn"
            onClick={() => setActionsOpen((open) => !open)}
            aria-expanded={actionsOpen}
            aria-label={actionsOpen ? 'Hide message actions' : 'Message actions'}
            title="Message actions"
          >
            <MoreHorizontal size={15} strokeWidth={1.75} />
          </button>
        ) : null}
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
        {(compactActions ? actionsOpen : true) && (
          <>
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
          </>
        )}
      </div>
    </article>
  )
}

const Bubble = memo(function Bubble({
  msg,
  messageIndex,
  thinking,
  isAuthed,
  compactActions = false,
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
        compactActions={compactActions}
        onEdit={onEditUserMessage}
        onResend={onResendUserMessage}
        onBranchChange={onBranchChange}
      />
    )
  }

  if (msg.role === 'assistant') {
    const showFeedback =
      Boolean(onEditUserMessage) &&
      !msg.ephemeral &&
      String(msg.text || '').trim().length > 0

    return (
      <article className="parle-chat-msg parle-chat-msg--assistant">
        <AssistantBody text={msg.text} />
        {showFeedback ? (
          compactActions ? (
            <OlderAssistantActions
              messageId={msg.id}
              modeId={msg.modeId}
              isAuthed={isAuthed}
              disabled={thinking}
            />
          ) : (
            <MessageFeedbackActions
              messageId={msg.id}
              modeId={msg.modeId}
              isAuthed={isAuthed}
              disabled={thinking}
            />
          )
        ) : null}
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
}, function bubblePropsEqual(prev, next) {
  return (
    prev.msg === next.msg &&
    prev.thinking === next.thinking &&
    prev.messageIndex === next.messageIndex &&
    prev.compactActions === next.compactActions &&
    prev.isAuthed === next.isAuthed
  )
})

function OlderAssistantActions({ messageId, modeId, isAuthed, disabled }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="parle-msg-feedback">
      <button
        type="button"
        className="parle-chat-msg__action-btn"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Hide reply feedback' : 'Reply feedback'}
        title="Reply feedback"
      >
        <MoreHorizontal size={15} strokeWidth={1.75} />
      </button>
      {open ? (
        <MessageFeedbackActions
          messageId={messageId}
          modeId={modeId}
          isAuthed={isAuthed}
          disabled={disabled}
        />
      ) : null}
    </div>
  )
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
  const [composerRestore, setComposerRestore] = useState(null)
  const composerDraftRef = useRef('')
  const [loadingRevision, setLoadingRevision] = useState(0)
  const scrollRef = useRef(null)
  const followScrollRef = useRef(true)
  const persistRunnerRef = useRef(null)
  const streamBatcherRef = useRef(null)
  const [chatMode, setChatMode] = useState(null)
  const [isAuthed, setIsAuthed] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [returningOpening, setReturningOpening] = useState(null)
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false)
  const [guestUsageRemaining, setGuestUsageRemaining] = useState(null)
  const [imageAttachConsent, setImageAttachConsent] = useState(false)
  const [stopContactPhase, setStopContactPhase] = useState(null)
  const [isNewSession, setIsNewSession] = useState(true)
  const [user, setUser] = useState(null)
  const [sidebarSessions, setSidebarSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [serverConversations, setServerConversations] = useState([])
  const [archivedConversations, setArchivedConversations] = useState([])
  const [legacyHistory, setLegacyHistory] = useState(null)
  const [legacyCursor, setLegacyCursor] = useState(null)
  const [legacyHasMore, setLegacyHasMore] = useState(false)
  const [legacyVersion, setLegacyVersion] = useState(null)
  const [legacyLoadingMore, setLegacyLoadingMore] = useState(false)
  const [legacyStale, setLegacyStale] = useState(false)
  const [generationRecovery, setGenerationRecovery] = useState(false)
  const [incompleteStream, setIncompleteStream] = useState(null)
  const [conversationTitles, setConversationTitles] = useState({})
  const [archivesRevision, setArchivesRevision] = useState(0)
  const [liveSessionTitle, setLiveSessionTitle] = useState(LIVE_SESSION_TITLE)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [onboardingAnswered, setOnboardingAnswered] = useState(true)
  const [onboardingReason, setOnboardingReason] = useState(null)
  const [onboardingSheetOpen, setOnboardingSheetOpen] = useState(false)
  const [productPulseVisible, setProductPulseVisible] = useState(false)
  const lastAssistantDoneAtRef = useRef(0)
  const pendingReplyRef = useRef(null)
  const [pendingModeId, setPendingModeId] = useState(DEFAULT_MODE.id)
  const [entryExiting, setEntryExiting] = useState(false)
  const sessionRef = useRef(createSessionState())
  const greetingPickRef = useRef(false)
  const [emptyGreeting, setEmptyGreeting] = useState('')
  const messagesRef = useRef(messages)
  const liveSessionTitleRef = useRef(LIVE_SESSION_TITLE)
  const activeSessionIdRef = useRef(activeSessionId)
  const chatModeRef = useRef(chatMode)
  const pendingModeIdRef = useRef(pendingModeId)
  const isAuthedRef = useRef(isAuthed)
  const loadingSessionsRef = useRef(new Set())
  const replyAbortRef = useRef(null)
  const sessionOpGenRef = useRef(0)
  const selectGenRef = useRef(0)
  const creatingConversationRef = useRef(false)
  const creatingPromiseRef = useRef(null)
  const liveClearedRef = useRef(false)
  messagesRef.current = messages
  liveSessionTitleRef.current = liveSessionTitle
  activeSessionIdRef.current = resolveActiveConversationRef({
    creating: creatingConversationRef.current,
    createPending: Boolean(creatingPromiseRef.current),
    renderedId: activeSessionId,
    rememberedId: activeSessionIdRef.current,
  })
  chatModeRef.current = chatMode
  pendingModeIdRef.current = pendingModeId
  isAuthedRef.current = isAuthed
  const legacyWrapId = legacyHistory?.conversation?.id || null

  function isLegacyHistoryId(id) {
    return Boolean(legacyWrapId && id && id === legacyWrapId)
  }

  function applyLegacyTranscript(payload, conversationId, userId, { bump = true } = {}) {
    rememberSelectedConversation(conversationId, userId, { bump })
    setMessages(mapConversationMessages(payload))
    setLegacyCursor(payload?.nextCursor || null)
    setLegacyHasMore(Boolean(payload?.hasMore))
    setLegacyVersion(payload?.timelineVersion || payload?.conversation?.timelineVersion || null)
    setLegacyStale(Boolean(payload?.stale))
    setIncompleteStream(null)
    applyGenerationState(payload)
    setIsNewSession(false)
    setChatMode(null)
    setStopContactPhase(null)
    setReturningOpening(null)
  }

  function getActiveStorageKey() {
    return resolveSessionStorageKey(activeSessionIdRef.current, sessionRef.current.sessionId)
  }

  function applyGenerationState(payload) {
    if (!payload || !payload.generation) return
    setGenerationRecovery(payload.generation.available === false)
  }

  async function refreshServerConversations() {
    const listed = await listConversations()
    if (listed.unauthorized) return []
    applyGenerationState(listed)
    setServerConversations(listed.conversations)
    return listed.conversations
  }

  async function refreshArchivedConversations() {
    const listed = await listConversations({ status: 'archived' })
    if (listed.unauthorized) return []
    setArchivedConversations(listed.conversations)
    return listed.conversations
  }

  function rememberSelectedConversation(conversationId, userId = user?.id, { bump = true } = {}) {
    if (bump && conversationId !== activeSessionIdRef.current) {
      selectGenRef.current += 1
    }
    if (userId) saveSelectedConversationId(userId, conversationId)
    setActiveSessionId(conversationId)
    activeSessionIdRef.current = conversationId
  }

  async function ensureActiveConversationId(modeId) {
    const current = activeSessionIdRef.current
    if (current && current !== CURRENT_SESSION_ID && !isLegacyHistoryId(current)) return current
    const created = await createConversation(modeId || 'cross')
    rememberSelectedConversation(created.id)
    await refreshServerConversations().catch(() => {})
    return created.id
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

  function bumpSessionOpGen() {
    sessionOpGenRef.current += 1
    return sessionOpGenRef.current
  }

  function abortInFlightReply() {
    streamBatcherRef.current?.flush()
    persistRunnerRef.current?.flush()
    if (replyAbortRef.current) {
      replyAbortRef.current.abort()
      replyAbortRef.current = null
    }
    loadingSessionsRef.current.clear()
    setLoadingRevision((n) => n + 1)
  }

  function canCommitMessages(storageKey, opGen) {
    return !shouldIgnoreCommit({
      storageKey,
      deletedIds: isArchiveDeleted(storageKey) ? [storageKey] : [],
      opGen,
      currentOpGen: sessionOpGenRef.current,
    })
  }

  function readMessagesForStorageKey(storageKey) {
    if (isViewingStorageKey(storageKey)) {
      return messagesRef.current || []
    }
    const archive = getChatArchiveById(storageKey)
    return archive?.messages || []
  }

  function persistTranscriptNow({ bumpOrder = false, chatModeId } = {}) {
    const current = messagesRef.current || []
    if (isAuthedRef.current) {
      const storageKey = getActiveStorageKey()
      const archive = getChatArchiveById(storageKey)
      if (!archive || isArchiveDeleted(storageKey)) return
      const persisted = current
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map(cloneMessage)
      if (!persisted.length) return
      saveChatArchive({
        id: storageKey,
        title: archive.title,
        messages: persisted,
        chatModeId: chatModeId || chatModeRef.current?.id || archive.chatModeId,
        bumpOrder,
      })
      if (bumpOrder) setArchivesRevision((n) => n + 1)
      return
    }
    saveGuestChatDraft({
      messages: current,
      chatModeId: chatModeRef.current?.id || null,
      pendingModeId: pendingModeIdRef.current,
    })
  }

  function scheduleTranscriptPersist() {
    persistRunnerRef.current?.schedule()
  }

  function commitMessages(storageKey, updater, { chatModeId, bumpOrder = false, opGen, persist = true } = {}) {
    if (!canCommitMessages(storageKey, opGen)) return readMessagesForStorageKey(storageKey)
    const prev = readMessagesForStorageKey(storageKey)
    const next = typeof updater === 'function' ? updater(prev) : updater
    const archive = getChatArchiveById(storageKey)

    if (persist && archive && isAuthedRef.current && !isArchiveDeleted(storageKey)) {
      saveChatArchive({
        id: storageKey,
        title: archive.title,
        messages: next
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map(cloneMessage),
        chatModeId: chatModeId || archive.chatModeId,
        bumpOrder,
      })
      if (bumpOrder) setArchivesRevision((n) => n + 1)
    }

    if (isViewingStorageKey(storageKey)) {
      setMessages(next)
    }

    if (persist && !isAuthedRef.current) {
      saveGuestChatDraft({
        messages: isViewingStorageKey(storageKey) ? next : currentGuestDraftMessages(storageKey, next),
        chatModeId: chatModeId || chatModeRef.current?.id || null,
        pendingModeId: pendingModeIdRef.current,
      })
    }

    return next
  }

  function currentGuestDraftMessages(storageKey, next) {
    if (isViewingStorageKey(storageKey)) return next
    return messagesRef.current || next
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
  }, [messages, user, isAuthed, historyLoading])

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
          setChatLocalUserId(authUser.id)
          clearGuestSessionToken()
          track('chat_loaded', { authed: true })
          const contextRes = await fetch('/api/chat/context')
          const context = contextRes.ok ? await contextRes.json() : {}

          if (!active) return

          setMemoryEnabled(Boolean(context?.memory_enabled))
          setImageAttachConsent(Boolean(context?.image_attach_consent))
          setOnboardingAnswered(Boolean(context?.onboarding_answered))
          setOnboardingReason(context?.onboarding_reason || null)
          setConversationTitles(loadConversationTitles(authUser.id))

          const [listed, archivedListed, legacyListed] = await Promise.all([
            listConversations(),
            listConversations({ status: 'archived' }),
            listLegacyHistory().catch(() => ({
              conversation: null,
              migration: { state: 'absent' },
            })),
          ])
          if (!active) return
          const conversations = listed.unauthorized ? [] : listed.conversations
          const archived = (archivedListed.unauthorized ? [] : archivedListed.conversations)
            .filter((row) => row.origin !== 'legacy_timeline')
          setServerConversations(conversations)
          setArchivedConversations(archived)
          setLegacyHistory(legacyListed.unauthorized ? { conversation: null, migration: { state: 'absent' } } : legacyListed)
          applyGenerationState(listed.unauthorized ? null : listed)
          if (!listed.generation) applyGenerationState(legacyListed)

          const bootGen = (selectGenRef.current += 1)
          const urlId = readConversationIdFromUrl()
          const storedId = loadStoredConversationId(authUser.id)
          const resolved = resolveConversationSelection({
            urlId,
            storedId,
            conversations,
            archivedConversations: archived,
          })

          if (resolved.fetchId) {
            let payload = null
            try {
              payload = await getConversation(resolved.fetchId)
            } catch {
              payload = null
            }
            if (
              !active ||
              !shouldApplyBootstrappedConversation({
                bootGen,
                currentGen: selectGenRef.current,
                fetchId: resolved.fetchId,
                urlId: readConversationIdFromUrl(),
                activeId: activeSessionIdRef.current,
              })
            ) {
              if (active && !creatingConversationRef.current) setHistoryLoading(false)
              return
            }
            if (!payload) {
              if (!pendingReplyRef.current) setMessages([])
              setIsNewSession(true)
              setActiveSessionId(null)
              activeSessionIdRef.current = null
              clearGuestChatDraft()
              setHistoryLoading(false)
              return
            }
            const history = mapConversationMessages(payload)
            const modeId = payload.conversation?.mode_id
            if (
              !shouldApplyBootstrappedConversation({
                bootGen,
                currentGen: selectGenRef.current,
                fetchId: resolved.fetchId,
                urlId: readConversationIdFromUrl(),
                activeId: activeSessionIdRef.current,
              })
            ) {
              if (!creatingConversationRef.current) setHistoryLoading(false)
              return
            }
            if (payload.conversation?.origin === 'legacy_timeline') {
              applyLegacyTranscript(payload, resolved.fetchId, authUser.id, { bump: false })
              clearGuestChatDraft()
              setHistoryLoading(false)
              return
            }
            rememberSelectedConversation(resolved.fetchId, authUser.id, { bump: false })
            if (!pendingReplyRef.current) {
              setMessages(history)
              setIsNewSession(history.length === 0)
              if (modeId) {
                const mode = getModeById(modeId)
                setChatMode({ id: mode.id, style: mode.style, mood: mode.mood })
              }
            }
            clearGuestChatDraft()
            setHistoryLoading(false)
            return
          }

          const guestDraft = loadGuestChatDraft()
          if (guestDraftHasUserMessages(guestDraft) && !pendingReplyRef.current) {
            const created = await createConversation(guestDraft.chatModeId || guestDraft.pendingModeId || 'cross')
            rememberSelectedConversation(created.id, authUser.id)
            await refreshServerConversations().catch(() => {})
            setMessages(guestDraft.messages)
            const modeId = guestDraft.chatModeId || guestDraft.pendingModeId
            if (modeId) {
              const mode = getModeById(modeId)
              setChatMode({ id: mode.id, style: mode.style, mood: mode.mood })
              setPendingModeId(mode.id)
            }
            setIsNewSession(false)
            clearGuestChatDraft()
            setHistoryLoading(false)
            return
          }

          // Empty account history → always start a fresh live chat
          clearLiveSessionMeta()
          clearGuestChatDraft()
          if (!pendingReplyRef.current) {
            setMessages([])
            setChatMode(null)
            setPendingModeId(getPreferredModeId(DEFAULT_MODE.id))
            setIsNewSession(true)
            setActiveSessionId(null)
            setLiveSessionTitle(LIVE_SESSION_TITLE)
            sessionRef.current = createSessionState()
          }
          setHistoryLoading(false)

          if (context?.memory_enabled && context?.has_last_session_summary) {
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

        setChatLocalUserId(null)
        track('chat_loaded', { authed: false })
        setUser(null)
        setOnboardingAnswered(isGuestOnboardingAnswered())
        setOnboardingReason(getGuestOnboardingReason())
        const guestDraft = loadGuestChatDraft()
        if (guestDraftHasUserMessages(guestDraft) && !pendingReplyRef.current) {
          setMessages(guestDraft.messages)
          const modeId = guestDraft.chatModeId || guestDraft.pendingModeId
          if (modeId) {
            const mode = getModeById(modeId)
            setChatMode({ id: mode.id, style: mode.style, mood: mode.mood })
            setPendingModeId(mode.id)
          }
          setIsNewSession(false)
        } else if (!hasUserMessages(messagesRef.current) && !pendingReplyRef.current) {
          setMessages([])
          setPendingModeId(getPreferredModeId(DEFAULT_MODE.id))
        }
        setHistoryLoading(false)

        fetch('/api/chat/guest-usage')
          .then((usageRes) => (usageRes.ok ? usageRes.json() : null))
          .then((payload) => {
            if (!active || payload?.remaining == null) return
            const remaining = Number(payload.remaining)
            if (Number.isFinite(remaining)) setGuestUsageRemaining(Math.max(0, remaining))
          })
          .catch(() => {})
      } catch {
        if (active) {
          setIsAuthed(false)
          if (!hasUserMessages(messagesRef.current) && !pendingReplyRef.current) {
            setMessages([])
          }
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
    const runner = createThrottledRunner(() => persistTranscriptNow())
    persistRunnerRef.current = runner
    return () => {
      runner.flush()
      persistRunnerRef.current = null
      streamBatcherRef.current?.cancel()
      streamBatcherRef.current = null
    }
  }, [])

  useEffect(() => {
    function persistOnLeave() {
      persistRunnerRef.current?.flush()
      persistTranscriptNow()
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') persistOnLeave()
    }
    window.addEventListener('pagehide', persistOnLeave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', persistOnLeave)
      document.removeEventListener('visibilitychange', onVisibility)
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

  const dismissProductPulse = useCallback(() => {
    setProductPulseVisible((visible) => (visible ? false : visible))
  }, [])

  useEffect(() => {
    const msgs = messages || []
    const last = msgs[msgs.length - 1]
    if (
      last?.role === 'assistant'
      && String(last.text || '').trim()
      && !last.ephemeral
      && !thinking
    ) {
      lastAssistantDoneAtRef.current = Date.now()
    }
  }, [messages, thinking])


  const syncFollowFromScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    followScrollRef.current = isNearBottom(el)
  }, [])

  const scrollToBottomIfFollowing = useCallback((behavior = 'auto') => {
    const el = scrollRef.current
    if (!el || !followScrollRef.current) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined
    el.addEventListener('scroll', syncFollowFromScroll, { passive: true })
    return () => el.removeEventListener('scroll', syncFollowFromScroll)
  }, [syncFollowFromScroll, historyLoading])

  useEffect(() => {
    if (migrateLegacyArchiveTitles()) {
      setArchivesRevision((n) => n + 1)
    }

    setSidebarSessions(
      buildSidebarSessionList({
        visibleMessages,
        activeSessionId,
        liveSessionTitle,
        isAuthed,
        serverConversations,
        conversationTitles,
      }),
    )
  }, [
    messages,
    chatMode,
    visibleMessages,
    isAuthed,
    activeSessionId,
    archivesRevision,
    liveSessionTitle,
    serverConversations,
    conversationTitles,
    historyLoading,
  ])

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
    if (!isAuthed) setActiveSessionId(CURRENT_SESSION_ID)

    if (!sessionRef.current.startingMode) {
      sessionRef.current.startingMode = mode.label
    }

    if (isSwitch) {
      sessionRef.current.modeSwitchCount += 1
      if (mode.id === 'stop_contact') {
        setStopContactPhase('awaiting_unsent')
        sessionRef.current.stopContactMessageCount = 0
      } else {
        setStopContactPhase(null)
      }
      return
    }

    if (mode.id === 'stop_contact') {
      setStopContactPhase('awaiting_unsent')
      sessionRef.current.stopContactMessageCount = 0
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

  async function completeOnboarding(reason) {
    const pending = pendingReplyRef.current
    pendingReplyRef.current = null

    setOnboardingSheetOpen(false)
    setOnboardingAnswered(true)
    setOnboardingReason(reason || 'skipped')

    if (isAuthed) {
      void fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }).catch(() => null)
    } else {
      saveGuestOnboarding(reason)
    }

    if (!pending) return

    messagesRef.current = pending.nextMessages
    setMessages(pending.nextMessages)

    startSessionLoading(pending.storageKey)
    try {
      track('chat_send', { authed: isAuthed, mode: pending.mode.id })
      await requestAssistantReply({
        ...pending,
      })
    } catch {
      commitMessages(pending.storageKey, (prev) => [
        ...(prev || []),
        createAssistantMessage('Sorry, something went wrong. Please try again.', {
          modeId: pending.mode.id,
        }),
      ], { chatModeId: pending.mode.id })
    } finally {
      stopSessionLoading(pending.storageKey)
    }
  }

  async function requestV2AssistantReply({
    userText,
    nextMessages,
    mode,
    dontTextStep,
    images = [],
    isEdit = false,
    editMessageIndex,
    storageKey = getActiveStorageKey(),
  }) {
    const conversationId = await ensureActiveConversationId(mode.id)
    const opGen = sessionOpGenRef.current
    const controller = new AbortController()
    replyAbortRef.current = controller
    const idempotencyKey = createMessageId()
    const session = sessionRef.current

    let res
    try {
      res = await postConversationMessage(
        conversationId,
        {
          text: userText,
          modeId: mode.id,
          dontTextStep,
          dontTextMessageCount: session.stopContactMessageCount,
          idempotencyKey,
          messages: toApiHistory(nextMessages.slice(0, -1)),
          images,
        },
        { signal: controller.signal },
      )
    } catch (error) {
      if (error?.name === 'AbortError') return false
      throw error
    }

    if (!canCommitMessages(conversationId, opGen) && !canCommitMessages(storageKey, opGen)) {
      return false
    }

    const contentType = res.headers.get('content-type') || ''
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const notice =
        data?.message
        || (res.status === 429
          ? data?.error === 'processing'
            ? 'Still finishing the last reply. Your message is saved.'
            : 'slow down a little.'
          : 'That reply did not come through. Your message is saved — try again.')
      commitMessages(
        conversationId,
        (prev) => [...(prev || []), createSystemNotice(notice)],
        { chatModeId: mode.id, opGen },
      )
      if (isViewingStorageKey(conversationId) && userText) {
        setComposerRestore({ key: Date.now(), text: userText })
      }
      return false
    }

    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}))
      const replyText = data.reply || ''
      if (!replyText && data.replay) return true
      const replyMessage = createAssistantMessage(replyText, { modeId: mode.id })
      commitMessages(
        conversationId,
        (prev) => {
          const merged = [...(prev || []), replyMessage]
          return isEdit && typeof editMessageIndex === 'number'
            ? syncBranchTail(merged, editMessageIndex)
            : merged
        },
        { chatModeId: mode.id, opGen },
      )
      session.lastAssistantAt = Date.now()
      if (isViewingStorageKey(conversationId)) {
        setIsNewSession(false)
        pulseWarmth(1, 1600)
        maybeAutoTitleSession([...(nextMessages || []), replyMessage])
        if (user?.id) saveConversationTitle(user.id, conversationId, liveSessionTitleRef.current)
      }
      return true
    }

    const assistantAt = Date.now()
    commitMessages(conversationId, (prev) => [
      ...(prev || []),
      createAssistantMessage('', { at: assistantAt, modeId: mode.id }),
    ], { chatModeId: mode.id, opGen, persist: true })

    let finalReply = ''
    const streamMeta = {}
    const applyStreamText = (replyText) => {
      commitMessages(
        conversationId,
        (prev) =>
          patchStreamingAssistantMessage(prev, {
            at: assistantAt,
            text: replyText,
            modeId: mode.id,
            ...(streamMeta.messageId ? { id: streamMeta.messageId } : {}),
          }),
        { chatModeId: mode.id, opGen, persist: false },
      )
      scrollToBottomIfFollowing('auto')
    }
    const batcher = createAnimationFrameBatcher(applyStreamText, {
      raf: (cb) => window.requestAnimationFrame(cb),
      caf: (id) => window.cancelAnimationFrame(id),
    })
    streamBatcherRef.current = batcher
    try {
      finalReply = await consumeChatStream(
        res,
        (replyText, payload) => {
          if (payload?.messageId != null) streamMeta.messageId = String(payload.messageId)
          if (payload?.done) {
            batcher.flush()
            applyStreamText(replyText)
            return
          }
          batcher.schedule(replyText)
        },
        controller.signal,
      )
      batcher.flush()
    } catch (error) {
      batcher.flush()
      if (error?.name === 'AbortError') {
        commitMessages(
          conversationId,
          (prev) => {
            const list = [...(prev || [])]
            const last = list[list.length - 1]
            if (last?.role === 'assistant' && last.at === assistantAt && !String(last.text || '').trim()) {
              list.pop()
            }
            return list
          },
          { chatModeId: mode.id, opGen, persist: true },
        )
        return false
      }
      commitMessages(
        conversationId,
        (prev) => {
          const list = [...(prev || [])]
          const last = list[list.length - 1]
          if (last?.role === 'assistant' && last.at === assistantAt && !String(last.text || '').trim()) {
            list.pop()
          }
          return [...list, createSystemNotice('That reply did not come through. Your message is saved — try again.')]
        },
        { chatModeId: mode.id, opGen, persist: true },
      )
      return false
    } finally {
      batcher.flush()
      batcher.cancel()
      if (streamBatcherRef.current === batcher) streamBatcherRef.current = null
    }

    if (!String(finalReply || '').trim()) {
      commitMessages(
        conversationId,
        (prev) => {
          const list = [...(prev || [])]
          const last = list[list.length - 1]
          if (last?.role === 'assistant' && last.at === assistantAt && !String(last.text || '').trim()) {
            list.pop()
          }
          return [...list, createSystemNotice('That reply did not come through. Your message is saved — try again.')]
        },
        { chatModeId: mode.id, opGen, persist: true },
      )
      return false
    }

    commitMessages(
      conversationId,
      (prev) =>
        patchStreamingAssistantMessage(prev, {
          at: assistantAt,
          text: finalReply,
          modeId: mode.id,
        }),
      { chatModeId: mode.id, opGen, persist: true },
    )
    session.lastAssistantAt = Date.now()
    if (isViewingStorageKey(conversationId)) {
      setIsNewSession(false)
      pulseWarmth(1, 1600)
      maybeAutoTitleSession([...(nextMessages || []), createAssistantMessage(finalReply, { modeId: mode.id })])
      if (user?.id) saveConversationTitle(user.id, conversationId, liveSessionTitleRef.current)
    }
    return true
  }

  async function requestAssistantReply({
    userText,
    nextMessages,
    mode,
    dontTextStep,
    images = [],
    isEdit = false,
    editMessageIndex,
    storageKey = getActiveStorageKey(),
  }) {
    if (isAuthed) {
      return requestV2AssistantReply({
        userText,
        nextMessages,
        mode,
        dontTextStep,
        images,
        isEdit,
        editMessageIndex,
        storageKey,
      })
    }
    const session = sessionRef.current
    const endpoint = '/api/chat/guest-send'
    const body = {
      text: userText,
      modeId: mode.id,
      dontTextStep,
      dontTextMessageCount: session.stopContactMessageCount,
      isNewSession: isAuthed && isNewSession && !isEdit,
      sessionId: session.sessionId,
      messages: toApiHistory(nextMessages.slice(0, -1)),
      images,
      ...(isEdit && isAuthed ? { isEdit: true } : {}),
      ...(!isAuthed ? { sessionToken: getGuestSessionToken() } : {}),
      ...(!isAuthed && onboardingReason ? { onboardingReason } : {}),
    }

    const opGen = sessionOpGenRef.current
    const controller = new AbortController()
    replyAbortRef.current = controller

    let res
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (error) {
      if (error?.name === 'AbortError') return
      throw error
    }

    if (!canCommitMessages(storageKey, opGen)) return

    if (!isAuthed) {
      const sessionHeader = res.headers.get('X-Parle-Guest-Session')
      if (sessionHeader) setGuestSessionToken(sessionHeader)
      const remaining = parseGuestUsageRemaining(res)
      if (remaining != null) setGuestUsageRemaining(remaining)
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (!isAuthed) {
        const remaining = parseGuestUsageRemaining(res, data)
        if (remaining != null) setGuestUsageRemaining(remaining)
      }
      if (res.status === 429 || res.status === 400) {
        const isProcessingLock = data?.error === 'processing'
        commitMessages(
          storageKey,
          (prev) => {
            const list = [...(prev || [])]
            if (list.length && list[list.length - 1]?.role === 'user') {
              list.pop()
            }
            if (isProcessingLock) return list
            const notice =
              data?.message ||
              (res.status === 429 ? 'slow down a little.' : 'something went wrong with that message.')
            return [...list, createSystemNotice(notice)]
          },
          { chatModeId: mode.id, opGen },
        )
        if (isViewingStorageKey(storageKey) && userText) {
          setComposerRestore({ key: Date.now(), text: userText })
        }
        return
      }

      commitMessages(storageKey, (prev) => [
        ...(prev || []),
        createAssistantMessage('Sorry, something went wrong. Please try again.', {
          modeId: mode.id,
        }),
      ], { chatModeId: mode.id, opGen })
      return
    }

    const contentType = res.headers.get('content-type') || ''
    const assistantAt = Date.now()

    if (contentType.includes('text/event-stream')) {
      commitMessages(storageKey, (prev) => [
        ...(prev || []),
        createAssistantMessage('', { at: assistantAt, modeId: mode.id }),
      ], { chatModeId: mode.id, opGen, persist: true })

      let finalReply = ''
      const streamMeta = {}
      const thinkMs = Number(res.headers.get('X-Parle-Think-Ms'))
      const applyStreamText = (replyText) => {
        commitMessages(
          storageKey,
          (prev) =>
            patchStreamingAssistantMessage(prev, {
              at: assistantAt,
              text: replyText,
              modeId: mode.id,
              ...(streamMeta.messageId ? { id: streamMeta.messageId } : {}),
            }),
          { chatModeId: mode.id, opGen, persist: false },
        )
        scrollToBottomIfFollowing('auto')
        scheduleTranscriptPersist()
      }
      const batcher = createAnimationFrameBatcher(applyStreamText, {
        raf: (cb) => window.requestAnimationFrame(cb),
        caf: (id) => window.cancelAnimationFrame(id),
      })
      streamBatcherRef.current = batcher
      try {
        finalReply = await consumeChatStream(
          res,
          (replyText, payload) => {
            if (payload?.messageId != null) streamMeta.messageId = String(payload.messageId)
            if (payload?.ttfbMs != null) streamMeta.ttfbMs = payload.ttfbMs
            if (payload?.done) {
              batcher.flush()
              applyStreamText(replyText)
              return
            }
            batcher.schedule(replyText)
          },
          controller.signal,
        )
        batcher.flush()
      } catch (error) {
        batcher.flush()
        if (error?.name === 'AbortError') {
          if (!canCommitMessages(storageKey, opGen)) return
          persistTranscriptNow({ chatModeId: mode.id })
          commitMessages(
            storageKey,
            (prev) => {
              const list = [...(prev || [])]
              const last = list[list.length - 1]
              if (
                last?.role === 'assistant' &&
                last.at === assistantAt &&
                !String(last.text || '').trim()
              ) {
                list.pop()
              }
              return list
            },
            { chatModeId: mode.id, opGen, persist: true },
          )
          return
        }
        throw error
      } finally {
        batcher.flush()
        batcher.cancel()
        if (streamBatcherRef.current === batcher) streamBatcherRef.current = null
      }

      const replyMessage = createAssistantMessage(finalReply || '', {
        at: assistantAt,
        modeId: mode.id,
        ...(streamMeta.messageId ? { id: streamMeta.messageId } : {}),
      })
      const withReply = [...nextMessages, replyMessage]
      persistRunnerRef.current?.flush()
      if (finalReply) {
        commitMessages(storageKey, (prev) => {
          const mapped = patchStreamingAssistantMessage(prev, {
            at: assistantAt,
            text: finalReply,
            modeId: mode.id,
            ...(streamMeta.messageId ? { id: streamMeta.messageId } : {}),
          })
          return isEdit && typeof editMessageIndex === 'number'
            ? syncBranchTail(mapped, editMessageIndex)
            : mapped
        }, { chatModeId: mode.id, opGen, persist: true })
      } else if (isEdit && typeof editMessageIndex === 'number') {
        commitMessages(storageKey, (prev) => syncBranchTail(prev || [], editMessageIndex), {
          chatModeId: mode.id,
          opGen,
          persist: true,
        })
      } else {
        persistTranscriptNow({ chatModeId: mode.id })
      }
      scrollToBottomIfFollowing('auto')

      session.lastAssistantAt = Date.now()
      if (isViewingStorageKey(storageKey)) {
        setIsNewSession(false)
        pulseWarmth(1, 1600)
        maybeAutoTitleSession(withReply)
      }
      track('chat_reply', { authed: isAuthed, safety: false, edit: isEdit })
      void maybeOfferOutcomeSurvey(withReply, mode.id, isEdit)
      track('chat_perf', {
        authed: isAuthed,
        thinkMs: Number.isFinite(thinkMs) ? thinkMs : undefined,
        ttfbMs: streamMeta.ttfbMs,
      })

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
      }, { chatModeId: mode.id, opGen })
      session.lastAssistantAt = Date.now()
      if (isViewingStorageKey(storageKey)) {
        setIsNewSession(false)
        pulseWarmth(1, 1600)
        maybeAutoTitleSession(withReply)
      }
      track('chat_reply', { authed: isAuthed, safety: Boolean(data?.safety), edit: isEdit })
      void maybeOfferOutcomeSurvey(withReply, mode.id, isEdit)

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

    await checkRepeatSentiment(truncated)

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
        isEdit: true,
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
    if (generationRecovery) return
    if (isLegacyHistoryId(activeSessionIdRef.current)) return
    const v = String(value || '').trim()
    const imagePayload = Array.isArray(images) ? images.filter(Boolean).slice(0, 2) : []
    if (creatingPromiseRef.current) {
      try {
        await creatingPromiseRef.current
      } catch {
        /* New Chat create failed; send uses whatever session remains */
      }
    }
    if (
      (!v && !imagePayload.length) ||
      isActiveSessionLoading() ||
      historyLoading ||
      creatingConversationRef.current
    ) {
      return
    }
    if (!isAuthed && guestUsageRemaining === 0) return

    let mode = resolveMode()
    let activeStopContactPhase = stopContactPhase
    if (!chatMode) {
      const selectedMode = getModeById(pendingModeId)
      mode = { id: selectedMode.id, style: selectedMode.style, mood: selectedMode.mood }
      setChatMode(mode)
      if (isAuthed) {
        setPreferredModeId(mode.id)
      }
      if (!isAuthed) {
        setActiveSessionId(CURRENT_SESSION_ID)
        activeSessionIdRef.current = CURRENT_SESSION_ID
      }
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

    liveClearedRef.current = false
    if (productPulseVisible) setProductPulseVisible(false)
    const displayText = v || (imagePayload.length ? '[Image attached]' : '')
    const nextMessages = [...(messages || []), createUserMessage(displayText, now)]
    followScrollRef.current = true
    setMessages(nextMessages)
    messagesRef.current = nextMessages
    if (isAuthed) {
      try {
        await ensureActiveConversationId(mode.id)
      } catch {
        commitMessages(getActiveStorageKey(), (prev) => [
          ...(prev || []),
          createSystemNotice('Could not start that chat. Your message is still here — try again.'),
        ])
        setComposerRestore({ key: Date.now(), text: v })
        return
      }
    }
    const storageKey = getActiveStorageKey()
    persistTranscriptNow({ bumpOrder: true, chatModeId: mode.id })
    requestAnimationFrame(() => scrollToBottomIfFollowing('auto'))

    void checkRepeatSentiment(nextMessages)

    let dontTextStep = null
    if (mode.id === 'stop_contact') {
      if (activeStopContactPhase === 'awaiting_unsent') {
        dontTextStep = 'after_unsent'
        setStopContactPhase('processing')
      } else {
        dontTextStep = 'processing'
      }
    }

    const shouldShowOnboardingAfterReply =
      !onboardingAnswered && !hasUserMessages(messages || [])

    startSessionLoading(storageKey)

    if (isViewingArchive(activeSessionId) && isAuthed && !isArchiveDeleted(activeSessionId)) {
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

    const sendOpGen = sessionOpGenRef.current
    pendingReplyRef.current = true
    try {
      track('chat_send', { authed: isAuthed, mode: mode.id })
      const sent = await requestAssistantReply({
        userText: v,
        nextMessages,
        mode,
        dontTextStep,
        images: imagePayload,
        storageKey,
      })
      if (sent === true && shouldShowOnboardingAfterReply) {
        setOnboardingSheetOpen(true)
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      commitMessages(storageKey, (prev) => [
        ...(prev || []),
        createSystemNotice('That reply did not come through. Your message is saved — try again.'),
      ], { chatModeId: mode.id, opGen: sendOpGen })
    } finally {
      pendingReplyRef.current = false
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

  function resetToPreChatSync({ preserveActiveConversation = false } = {}) {
    clearGuestChatDraft()
    setMessages([])
    setChatMode(null)
    setPendingModeId(getPreferredModeId(DEFAULT_MODE.id))
    clearLiveSessionMeta()
    setEntryExiting(false)
    setGuestBannerDismissed(false)
    setStopContactPhase(null)
    setIsNewSession(true)
    if (!preserveActiveConversation) {
      setActiveSessionId(null)
    }
    setLiveSessionTitle(LIVE_SESSION_TITLE)
    setReturningOpening(null)
    greetingPickRef.current = false
    setEmptyGreeting('')
    setProductPulseVisible(false)
    sessionRef.current = createSessionState()
  }

  async function maybeOfferOutcomeSurvey(nextMessages, modeId, isEdit) {
    if (isEdit || productPulseVisible || thinking) return
    if (String(composerDraftRef.current || '').trim()) return
    const userMessages = (nextMessages || []).filter((m) => m.role === 'user')
    if (userMessages.length < 2) return
    const lastUser = [...userMessages].reverse()[0]
    if (!surveyEnding.isSurveyConversationEnding(lastUser?.text)) return
    if (wasOutcomeSurveyShownToday()) return
    if (isAuthed) {
      try {
        const statusRes = await fetch('/api/feedback/product', { credentials: 'same-origin' })
        const status = statusRes.ok ? await statusRes.json() : {}
        if (status.askedToday) {
          markOutcomeSurveyShownToday()
          return
        }
      } catch {
        /* still try to show */
      }
    }
    markOutcomeSurveyShownToday()
    await fetch('/api/feedback/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        action: 'shown',
        session_id: isAuthed ? sessionRef.current.sessionId : getGuestSessionToken(),
        mode_id: modeId,
        is_guest: !isAuthed,
        message_count: userMessages.length,
      }),
    }).catch(() => null)
    setProductPulseVisible(true)
  }

  function discardLiveAndArchives(snapshot) {
    bumpSessionOpGen()
    abortInFlightReply()
    liveClearedRef.current = true
    if (snapshot?.sessionId) {
      removeChatArchive(snapshot.sessionId)
    }
    if (snapshot?.messages?.length) {
      pruneArchivesMatchingMessages(snapshot.messages)
    }
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

    // Intentionally do not call /api/chat/clear. That endpoint deletes the
    // whole account timeline. Session-end only writes a summary.
  }

  async function clearChat() {
    bumpSessionOpGen()
    const createGen = sessionOpGenRef.current
    abortInFlightReply()

    if (isAuthed) {
      const previous = creatingPromiseRef.current
      creatingConversationRef.current = true
      const pending = (async () => {
        try {
          if (previous) {
            try {
              await previous
            } catch {
              /* previous New Chat failed or was superseded */
            }
          }
          if (createGen !== sessionOpGenRef.current) return
          const created = await createConversation(pendingModeIdRef.current || chatMode?.id || 'cross')
          if (createGen !== sessionOpGenRef.current) return
          messagesRef.current = []
          resetToPreChatSync({ preserveActiveConversation: true })
          rememberSelectedConversation(created.id)
          await refreshServerConversations().catch(() => {})
        } catch {
          if (createGen !== sessionOpGenRef.current) return
          rememberSelectedConversation(null)
          resetToPreChatSync()
        } finally {
          if (createGen === sessionOpGenRef.current) {
            creatingConversationRef.current = false
            setHistoryLoading(false)
          }
        }
      })()
      creatingPromiseRef.current = pending
      try {
        await pending
      } finally {
        if (creatingPromiseRef.current === pending) creatingPromiseRef.current = null
        if (createGen === sessionOpGenRef.current) setHistoryLoading(false)
      }
      setArchivesRevision((n) => n + 1)
      track('chat_deleted', { authed: true, source: 'new_chat' })
      return
    }

    const currentMessages = messages || []
    const shouldArchive = shouldArchiveLiveChat(activeSessionId, currentMessages)
    const snapshot = shouldArchive ? captureSessionSnapshot() : null

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

    liveClearedRef.current = true
    resetToPreChatSync()
    setArchivesRevision((n) => n + 1)

    if (snapshot) {
      void finalizePreviousSession(snapshot)
    }

    track('chat_deleted', { authed: isAuthed })
    await refreshReturningOpening()
  }

  async function handleArchiveSession(session, e) {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!isAuthed || !session?.archivable) return
    bumpSessionOpGen()
    abortInFlightReply()
    const archived = await archiveConversationRequest(session.id)
    if (!archived) return
    const listed = await refreshServerConversations()
    await refreshArchivedConversations().catch(() => {})
    if (activeSessionIdRef.current === session.id) {
      const next = listed.find((row) => row.id !== session.id) || listed[0]
      if (next) {
        rememberSelectedConversation(next.id)
        const payload = await getConversation(next.id)
        if (payload) {
          setMessages(mapConversationMessages(payload))
          setIsNewSession(!(payload.messages || []).length)
        }
      } else {
        rememberSelectedConversation(null)
        resetToPreChatSync()
      }
    }
  }

  async function handleRestoreSession(session, e) {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!isAuthed || !session?.id) return
    const restored = await restoreConversationRequest(session.id)
    if (!restored) return
    await refreshServerConversations()
    await refreshArchivedConversations().catch(() => {})
    rememberSelectedConversation(restored.id)
    const payload = await getConversation(restored.id)
    if (payload) {
      setMessages(mapConversationMessages(payload))
      setIsNewSession(!(payload.messages || []).length)
    }
    setMobileSidebarOpen(false)
  }

  function handleDeleteSession(session, e) {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (isAuthed || session?.archiveUnavailable) return
    if (!session?.deletable) return

    if (session.id === CURRENT_SESSION_ID) {
      const snapshot = hasUserMessages(messages || []) ? captureSessionSnapshot() : null
      discardLiveAndArchives(snapshot)
      resetToPreChatSync()
      setArchivesRevision((n) => n + 1)
      track('chat_deleted', { authed: isAuthed, source: 'sidebar' })

      void (async () => {
        if (snapshot) {
          await finalizePreviousSession(snapshot)
        }
        await refreshReturningOpening()
      })()
      return
    }

    bumpSessionOpGen()
    abortInFlightReply()
    removeChatArchive(session.id)
    setArchivesRevision((n) => n + 1)

    if (activeSessionId === session.id || activeSessionIdRef.current === session.id) {
      liveClearedRef.current = true
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
    if (liveClearedRef.current) return null

    const currentMessages = (messages || []).filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    )
    if (!hasUserMessages(currentMessages)) return null

    if (shouldArchiveLiveChat(activeSessionId, currentMessages)) {
      const archiveId = sessionRef.current.sessionId
      if (isArchiveDeleted(archiveId)) return null
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
      if (isArchiveDeleted(activeSessionId)) return null
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

  async function handleSelectLegacyHistory() {
    const wrap = legacyHistory?.conversation
    if (!wrap?.id) return
    bumpSessionOpGen()
    abortInFlightReply()
    const mySelect = (selectGenRef.current += 1)
    const payload = await getConversation(wrap.id)
    if (mySelect !== selectGenRef.current) return
    if (!payload) return
    applyLegacyTranscript(payload, wrap.id, user?.id)
    sessionRef.current = createSessionState()
  }

  async function loadMoreLegacyHistory() {
    const wrap = legacyHistory?.conversation
    if (!wrap?.id || !legacyHasMore || legacyLoadingMore) return
    setLegacyLoadingMore(true)
    try {
      const payload = await getConversation(wrap.id, {
        cursor: legacyCursor,
        version: legacyVersion,
      })
      if (!payload) return
      if (payload.stale) {
        applyLegacyTranscript(payload, wrap.id, user?.id, { bump: false })
        return
      }
      setMessages((prev) => mergeLegacyPages(prev, mapConversationMessages(payload)))
      setLegacyCursor(payload.nextCursor || null)
      setLegacyHasMore(Boolean(payload.hasMore))
      setLegacyVersion(payload.timelineVersion || legacyVersion)
      setLegacyStale(false)
    } finally {
      setLegacyLoadingMore(false)
    }
  }

  async function handleSelectSession(session) {
    if (!session?.loadable) return
    if (session.id === activeSessionIdRef.current) return

    bumpSessionOpGen()
    abortInFlightReply()
    const mySelect = (selectGenRef.current += 1)

    if (isAuthed) {
      const payload = await getConversation(session.id)
      if (mySelect !== selectGenRef.current) return
      if (!payload) return
      if (payload.conversation?.origin === 'legacy_timeline') {
        applyLegacyTranscript(payload, session.id, user?.id)
        sessionRef.current = createSessionState()
        return
      }
      rememberSelectedConversation(session.id)
      setMessages(mapConversationMessages(payload))
      setIncompleteStream(payload.incompleteStream || null)
      applyGenerationState(payload)
      setIsNewSession(!(payload.messages || []).length)
      setChatMode(
        payload.conversation?.mode_id
          ? { id: payload.conversation.mode_id, ...getModeById(payload.conversation.mode_id) }
          : chatMode,
      )
      setStopContactPhase(null)
      setLegacyHasMore(false)
      setLegacyCursor(null)
      sessionRef.current = createSessionState()
      return
    }

    const parked = persistSessionBeforeSwitch(session.id)
    if (parked) {
      setArchivesRevision((n) => n + 1)
      if (parked.type === 'live' && parked.snapshot) {
        void finalizePreviousSession(parked.snapshot)
      }
    }

    if (session.id === CURRENT_SESSION_ID) {
      if (liveClearedRef.current) {
        if (mySelect !== selectGenRef.current) return
        setMessages([])
        setChatMode(null)
        setActiveSessionId(CURRENT_SESSION_ID)
        return
      }
      if (isAuthed) {
        const historyRes = await fetch('/api/chat/history')
        if (mySelect !== selectGenRef.current) return
        const rows = historyRes.ok ? await historyRes.json() : []
        const history = mapServerHistory(rows)
        setMessages(history)
        if (history.length) {
          restoreLiveSessionFromMeta(loadLiveSessionMeta(), { history })
        } else {
          setChatMode(null)
        }
      }

      liveClearedRef.current = false
      setActiveSessionId(CURRENT_SESSION_ID)
      return
    }

    const archive = getChatArchiveById(session.id)
    if (!archive || isArchiveDeleted(session.id)) {
      setArchivesRevision((n) => n + 1)
      return
    }
    if (mySelect !== selectGenRef.current) return
    liveClearedRef.current = false

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
    setIsNewSession(false)
    sessionRef.current = createSessionState()
  }

  const hasLiveUserMessages = hasUserMessages(visibleMessages)
  const isLiveSession = isActiveLiveSession(activeSessionId) && !isViewingArchive(activeSessionId)
  const resolvedActiveSessionId =
    activeSessionId ??
    (hasLiveUserMessages && isLiveSession ? CURRENT_SESSION_ID : null)
  const viewingLegacy = isLegacyHistoryId(activeSessionId)
  const chatActive = hasLiveUserMessages || thinking || viewingLegacy || generationRecovery
  const guestDailyCapReached = !isAuthed && guestUsageRemaining === 0
  const inputDisabled = thinking || historyLoading || guestDailyCapReached || viewingLegacy || generationRecovery
  const showEmptyUI = !viewingLegacy && !generationRecovery && (entryExiting || (!hasLiveUserMessages && !thinking))
  const userMessageCount = visibleMessages.filter((m) => m.role === 'user').length
  const showUsageHint =
    !isAuthed &&
    guestUsageRemaining != null &&
    guestUsageRemaining > 0 &&
    guestUsageRemaining <= 5
  const showGuestBanner =
    !isAuthed &&
    !guestBannerDismissed &&
    userMessageCount >= 10 &&
    chatActive &&
    !showUsageHint &&
    !guestDailyCapReached
  const showStopContactLabel = chatMode?.id === 'stop_contact' && chatActive
  const lastVisibleMessage = visibleMessages[visibleMessages.length - 1]
  const showTypingIndicator =
    thinking &&
    (!lastVisibleMessage ||
      lastVisibleMessage.role === 'user' ||
      (lastVisibleMessage.role === 'assistant' && !String(lastVisibleMessage.text || '').trim()))

  const sendRef = useRef(send)
  sendRef.current = send
  const onSendStable = useCallback((payload) => sendRef.current(payload), [])
  const modeChangeRef = useRef(handleModeChange)
  modeChangeRef.current = handleModeChange
  const onModeChangeStable = useCallback((mode) => modeChangeRef.current(mode), [])

  let lastUserIndex = -1
  let lastAssistantIndex = -1
  for (let i = 0; i < (messages || []).length; i += 1) {
    if (messages[i]?.role === 'user') lastUserIndex = i
    if (messages[i]?.role === 'assistant' && String(messages[i].text || '').trim()) {
      lastAssistantIndex = i
    }
  }

  return (
    <ChatComposerProvider
      restore={composerRestore}
      onOccupied={dismissProductPulse}
      draftRef={composerDraftRef}
    >
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
        onArchiveSession={handleArchiveSession}
        onRestoreSession={handleRestoreSession}
        archivedSessions={(archivedConversations || []).map((row) => ({
          id: row.id,
          title: conversationTitles?.[row.id] || row.title || LIVE_SESSION_TITLE,
        }))}
        legacyHistory={legacyHistory}
        onSelectLegacyHistory={handleSelectLegacyHistory}
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
                isAuthed={isAuthed}
              />
            </div>
          ) : chatActive ? (
            <div className="parle-chat__messages">
              {generationRecovery && !viewingLegacy ? (
                <motion.div
                  className="parle-chat-history-banner"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  <p className="parle-chat-history-banner__label">Read-only for now</p>
                  <p className="parle-chat-history-banner__text">
                    Replies are temporarily unavailable. Your earlier conversations and saved chats are still here.
                  </p>
                  {incompleteStream ? (
                    <p className="parle-chat-history-banner__text" style={{ marginTop: '0.4rem' }}>
                      The last reply did not finish. Existing messages were kept.
                      {incompleteStream.retryable ? ' You can retry when replies return.' : ' Retry is unavailable until replies return.'}
                    </p>
                  ) : null}
                </motion.div>
              ) : null}
              {viewingLegacy ? (
                <motion.div
                  className="parle-chat-history-banner"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  <p className="parle-chat-history-banner__label">Read-only history</p>
                  <p className="parle-chat-history-banner__text">
                    {legacyHistory?.migration?.incomplete
                      ? 'This is your previous account history. It is still being saved, so some older messages may be missing. New chats stay separate.'
                      : legacyHistory?.migration?.pendingQuiesce
                        ? 'This is your previous account history, kept in the order it was saved. Additional older messages may still arrive. New chats stay separate.'
                        : 'This is your previous account history, kept in the order it was saved. It is not one original chat. New chats stay separate.'}
                  </p>
                  {legacyStale ? (
                    <p className="parle-chat-history-banner__text" style={{ marginTop: '0.4rem' }}>
                      Saved history was updated. The list was refreshed from the start.
                    </p>
                  ) : null}
                  <div className="parle-chat-history-banner__actions">
                    <button
                      type="button"
                      className="parle-chat-history-banner__btn parle-chat-history-banner__btn--primary"
                      onClick={() => clearChat()}
                    >
                      New Chat
                    </button>
                  </div>
                </motion.div>
              ) : null}
              {viewingLegacy && !(messages || []).length ? (
                <p className="parle-chat-history-empty">
                  {legacyHistory?.migration?.incomplete
                    ? 'No saved history is available yet.'
                    : 'No saved history messages were found for this account.'}
                </p>
              ) : null}
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
                    key={m.id || `${m.role}-${i}`}
                    msg={m}
                    messageIndex={i}
                    thinking={thinking}
                    isAuthed={isAuthed}
                    compactActions={i !== lastUserIndex && i !== lastAssistantIndex}
                    onEditUserMessage={viewingLegacy || generationRecovery ? undefined : editUserMessage}
                    onResendUserMessage={viewingLegacy || generationRecovery ? undefined : resendUserMessage}
                    onBranchChange={viewingLegacy || generationRecovery ? undefined : switchMessageBranch}
                  />
                )
              })}
              {showTypingIndicator && <TypingIndicator />}
              {viewingLegacy && legacyHasMore ? (
                <div className="parle-chat-history-banner__actions" style={{ justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="parle-chat-history-banner__btn"
                    onClick={loadMoreLegacyHistory}
                    disabled={legacyLoadingMore}
                  >
                    {legacyLoadingMore ? 'Loading…' : 'Load more history'}
                  </button>
                </div>
              ) : null}
              {viewingLegacy && !legacyHasMore && (messages || []).length > 0 ? (
                <p className="parle-chat-history-empty">
                  {legacyHistory?.migration?.incomplete || legacyHistory?.migration?.pendingQuiesce
                    ? 'End of currently saved history. Migration is not fully settled yet.'
                    : 'End of saved history.'}
                </p>
              ) : null}
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
              {guestDailyCapReached ? (
                <GuestLimitBlock />
              ) : (
                <ChatInputBar
                  onSend={onSendStable}
                  disabled={inputDisabled}
                  loading={thinking}
                  activeModeId={chatMode?.id || pendingModeId}
                  onModeChange={onModeChangeStable}
                  isAuthed={isAuthed}
                  imageConsentFromServer={imageAttachConsent}
                />
              )}
            </div>

            <EmptyStateQuickPrompts
              onSelect={(prompt) => send({ text: prompt })}
              disabled={thinking || historyLoading || guestDailyCapReached}
              exiting={entryExiting}
            />
          </div>
        )}

        <OnboardingSheet
          open={onboardingSheetOpen}
          onSelect={completeOnboarding}
          onSkip={() => completeOnboarding('skipped')}
        />

        <div className="parle-chat-main__bottom-fixed">
          {!isAuthed && <GuestConsentBanner visible />}
          <div className="parle-chat-main__bottom-inner">
            <ProductPulseCard
              visible={productPulseVisible && !showEmptyUI && !viewingLegacy}
              sessionId={
                isAuthed
                  ? sessionRef.current.sessionId
                  : getGuestSessionToken()
              }
              messageCount={userMessageCount}
              modeId={chatMode?.id || pendingModeId}
              isGuest={!isAuthed}
              onDismiss={() => setProductPulseVisible(false)}
            />
            {!showEmptyUI && showGuestBanner && (
              <div className="parle-chat__composer-notice">
                <div className="parle-chat__composer-notice-bar">
                  <p className="parle-chat__composer-notice-text">
                    Your chat disappears when you leave. Create a free account to save it.
                  </p>
                  <Link href="/register" className="parle-chat__composer-notice-action">
                    Save
                  </Link>
                  <button
                    type="button"
                    onClick={() => setGuestBannerDismissed(true)}
                    className="parle-chat__composer-notice-close"
                    aria-label="Dismiss"
                  >
                    <X size={16} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            )}

            {!guestDailyCapReached && showUsageHint && (
              <GuestUsageHint remaining={guestUsageRemaining} />
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
              {viewingLegacy || generationRecovery ? null : guestDailyCapReached ? (
                <GuestLimitBlock />
              ) : (
                <ChatInputBar
                  onSend={onSendStable}
                  disabled={inputDisabled}
                  loading={thinking}
                  activeModeId={chatMode?.id || pendingModeId}
                  onModeChange={onModeChangeStable}
                  isAuthed={isAuthed}
                  imageConsentFromServer={imageAttachConsent}
                />
              )}
            </div>

            <p className="parle-chat__disclaimer">
              <Lock size={11} strokeWidth={2} aria-hidden />
              <span>Private · Not a crisis service</span>
            </p>
          </div>
        </div>
      </div>
    </div>
    </ChatComposerProvider>
  )
}
