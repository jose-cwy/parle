import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Settings,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { cn } from '../../lib/cn'
import { ParleSettingsPopup } from './ParleSettings'

function userDisplayName(user) {
  if (!user) return 'Guest'
  if (user.preferred_name?.trim()) return user.preferred_name.trim()
  return user.email?.split('@')[0] || 'You'
}

function userInitial(user) {
  const name = userDisplayName(user)
  return name.charAt(0).toUpperCase()
}

export default function ParleChatSidebar({
  isAuthed,
  user,
  sessions,
  activeSessionId,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
}) {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(isAuthed ? '/dashboard' : '/')
  }

  function startRename(session, e) {
    e.preventDefault()
    e.stopPropagation()
    setRenamingId(session.id)
    setRenameDraft(session.title)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameDraft('')
  }

  function commitRename(session) {
    const trimmed = renameDraft.trim()
    if (trimmed && trimmed !== session.title) {
      onRenameSession?.(session, trimmed)
    }
    cancelRename()
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="parle-chat-sidebar__backdrop md:hidden"
          aria-label="Close sidebar"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={cn(
          'parle-chat-sidebar',
          mobileOpen && 'parle-chat-sidebar--open',
        )}
        aria-label="Chat sidebar"
      >
        <div className="parle-chat-sidebar__header">
          <div className="parle-chat-sidebar__brand-row">
            <button
              type="button"
              onClick={handleBack}
              className="parle-chat-sidebar__back-btn"
              aria-label="Go back"
              title="Go back"
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            </button>
            <Link
              href="/dashboard"
              className="parle-chat-sidebar__wordmark parle-chat-sidebar__wordmark-link font-serif text-[1.2125rem] leading-none text-foreground tracking-tight"
            >
              parlé
            </Link>
            <div className="parle-chat-sidebar__brand-actions">
              <button
                type="button"
                className="parle-chat-sidebar__collapse-btn hidden md:grid"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                onClick={onToggleCollapse}
              >
                <PanelLeftClose size={17} strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onNewChat()
              onCloseMobile?.()
            }}
            className="mt-4 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/80 text-[11px] text-foreground/90 hover:bg-black/[0.03] transition"
          >
            <SquarePen size={15} strokeWidth={1.75} className="shrink-0 opacity-70" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="parle-chat-sidebar__history">
          {sessions.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {sessions.map((session) => {
                  const active = session.id === activeSessionId
                  const disabled = session.loadable === false
                  const showDelete = session.deletable && !disabled
                  const showRename = session.renamable && !disabled
                  const showActions = showRename || showDelete
                  const isRenaming = renamingId === session.id

                  return (
                    <li key={session.id} className="group relative">
                      {isRenaming ? (
                        <div className="px-2 py-1.5">
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameDraft}
                            maxLength={80}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                commitRename(session)
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault()
                                cancelRename()
                              }
                            }}
                            onBlur={() => commitRename(session)}
                            className="parle-chat-sidebar__rename-input"
                            aria-label="Chat name"
                          />
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (!disabled) {
                                onSelectSession(session)
                                onCloseMobile?.()
                              }
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2.5 rounded-lg text-[11px] leading-snug transition',
                              showActions ? 'pr-[4.25rem]' : '',
                              active
                                ? 'bg-black/[0.06] text-foreground'
                                : disabled
                                  ? 'text-muted-foreground/50 cursor-default'
                                  : 'text-foreground/80 hover:bg-black/[0.04]',
                            )}
                            title={session.title}
                          >
                            <span className="block truncate">{session.title}</span>
                          </button>
                          {showActions && (
                            <div
                              className={cn(
                                'parle-chat-sidebar__session-actions',
                                active && 'parle-chat-sidebar__session-actions--visible',
                              )}
                            >
                              {showRename && (
                                <button
                                  type="button"
                                  onClick={(e) => startRename(session, e)}
                                  className="parle-chat-sidebar__session-action"
                                  aria-label={`Rename ${session.title}`}
                                  title="Rename chat"
                                >
                                  <Pencil size={14} strokeWidth={1.75} />
                                </button>
                              )}
                              {showDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => onDeleteSession(session, e)}
                                  className="parle-chat-sidebar__session-action parle-chat-sidebar__session-action--delete"
                                  aria-label={`Delete ${session.title}`}
                                  title="Delete chat"
                                >
                                  <Trash2 size={14} strokeWidth={1.75} />
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-3 text-[10px] text-muted-foreground leading-relaxed">
                Your conversations will appear here.
              </p>
            )}
          {!isAuthed && (
            <div className="px-3 mt-3 pt-3 border-t border-border/60">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Chats are saved on this device.{' '}
                <Link
                  href="/register"
                  className="text-foreground underline underline-offset-2 hover:text-primary transition"
                >
                  Sign up
                </Link>{' '}
                to sync across devices.
              </p>
            </div>
          )}
        </div>

        <div className="parle-chat-sidebar__footer">
          <div className="flex items-center gap-1.5 px-3 pb-3 text-[8px] text-muted-foreground">
            <Lock size={11} strokeWidth={2} aria-hidden />
            <span>Private by default</span>
          </div>

          {isAuthed && user ? (
            <div className="flex items-center gap-2 px-2 py-2 rounded-xl mx-1 hover:bg-black/[0.03] transition">
              <span className="parle-chat-sidebar__avatar" aria-hidden="true">
                {userInitial(user)}
              </span>
              <span className="flex-1 min-w-0 text-[11px] text-foreground truncate">
                {userDisplayName(user)}
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground transition"
                aria-label="Settings"
                title="Settings"
              >
                <Settings size={16} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 px-3 py-2 text-[11px]">
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition">
                Log in
              </Link>
              <Link href="/register" className="text-foreground hover:text-primary transition">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </aside>

      <ParleSettingsPopup
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isAuthed={isAuthed}
      />
    </>
  )
}

export function ParleChatMobileMenuButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="parle-chat-sidebar-toggle parle-chat-sidebar-toggle--mobile md:hidden"
      aria-label="Open chat menu"
    >
      <Menu size={20} strokeWidth={1.75} />
    </button>
  )
}

export function ParleChatSidebarExpandButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="parle-chat-sidebar-toggle parle-chat-sidebar-toggle--desktop hidden md:grid"
      aria-label="Expand sidebar"
      title="Expand sidebar"
    >
      <PanelLeftOpen size={20} strokeWidth={1.75} />
    </button>
  )
}
