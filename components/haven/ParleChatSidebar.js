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
import {
  getChatReturnPath,
  navigateAwayFromChat,
  prefetchChatExitRoutes,
  rememberChatReturnFromReferrer,
} from '../../lib/parle/chatNavigation'
import ParleLogo from '../brand/ParleLogo'

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
  onOpenSettings,
}) {
  const router = useRouter()
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  useEffect(() => {
    rememberChatReturnFromReferrer()
    prefetchChatExitRoutes(router)
  }, [router])

  function navigateFromSidebar(path) {
    navigateAwayFromChat(router, path, { onNavigate: onCloseMobile })
  }

  function handleBack() {
    navigateFromSidebar(getChatReturnPath('/'))
  }

  function handleLogoClick() {
    navigateFromSidebar('/')
  }

  function prefetchSidebarDestination(path) {
    const target = path || getChatReturnPath('/')
    void router.prefetch(target)
  }

  function handleLoginClick() {
    navigateFromSidebar('/login')
  }

  function handleSignupClick() {
    navigateFromSidebar('/register')
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
          className="parle-chat-sidebar__backdrop parle-mobile-only"
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
              onMouseEnter={() => prefetchSidebarDestination(getChatReturnPath('/'))}
              onFocus={() => prefetchSidebarDestination(getChatReturnPath('/'))}
              className="parle-chat-sidebar__back-btn"
              aria-label="Go back"
              title="Go back"
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleLogoClick}
              onMouseEnter={() => prefetchSidebarDestination('/')}
              onFocus={() => prefetchSidebarDestination('/')}
              className="parle-chat-sidebar__brand-logo"
              aria-label="parlé home"
            >
              <ParleLogo variant="inline" size="md" />
            </button>
            <div className="parle-chat-sidebar__brand-actions">
              <button
                type="button"
                className="parle-chat-sidebar__collapse-btn"
                aria-label={mobileOpen ? 'Close sidebar' : 'Collapse sidebar'}
                title={mobileOpen ? 'Close sidebar' : 'Collapse sidebar'}
                onClick={() => {
                  if (mobileOpen) onCloseMobile?.()
                  else onToggleCollapse()
                }}
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
            className="parle-chat-sidebar__new-chat mt-4 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/80 text-[11px] text-foreground/90 hover:bg-black/[0.03] transition"
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
                Nothing is stored. Your chat exists only in this session.{' '}
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
          <div className="parle-chat-sidebar__privacy-note">
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
                onClick={() => {
                  onOpenSettings?.()
                  onCloseMobile?.()
                }}
                className="parle-chat-sidebar__settings-btn"
                aria-label="Settings"
                title="Settings"
              >
                <Settings size={15} strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="parle-chat-sidebar__auth-links">
              <button
                type="button"
                onClick={handleLoginClick}
                className="parle-chat-sidebar__auth-pill parle-chat-sidebar__auth-pill--login"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={handleSignupClick}
                className="parle-chat-sidebar__auth-pill parle-chat-sidebar__auth-pill--signup"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

export function ParleChatMobileMenuButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="parle-chat-sidebar-toggle parle-chat-sidebar-toggle--mobile parle-mobile-only"
      aria-label="Open chat menu"
    >
      <Menu size={20} strokeWidth={1.75} />
    </button>
  )
}

export function ParleChatMobileToolbar({ onOpenHistory }) {
  return (
    <div className="parle-chat-mobile-toolbar parle-mobile-only">
      <button
        type="button"
        onClick={onOpenHistory}
        className="parle-chat-mobile-toolbar__btn parle-chat-sidebar-toggle parle-chat-sidebar-toggle--open"
        aria-label="Open sidebar"
      >
        <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  )
}

export function ParleChatSidebarExpandButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="parle-chat-sidebar-toggle parle-chat-sidebar-toggle--desktop parle-desktop-only"
      aria-label="Expand sidebar"
      title="Expand sidebar"
    >
      <PanelLeftOpen size={20} strokeWidth={1.75} />
    </button>
  )
}
