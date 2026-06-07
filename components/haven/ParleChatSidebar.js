import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import {
  ChevronLeft,
  Lock,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
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
}) {
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(isAuthed ? '/dashboard' : '/')
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
              className="parle-chat-sidebar__wordmark parle-chat-sidebar__wordmark-link font-serif text-[1.35rem] leading-none text-foreground tracking-tight"
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
            className="mt-4 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/80 text-[13px] text-foreground/90 hover:bg-black/[0.03] transition"
          >
            <SquarePen size={15} strokeWidth={1.75} className="shrink-0 opacity-70" />
            <span>New chat</span>
          </button>
        </div>

        <div className="parle-chat-sidebar__history">
          {isAuthed ? (
            sessions.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {sessions.map((session) => {
                  const active = session.id === activeSessionId
                  const disabled = session.loadable === false
                  const showDelete = session.deletable && !disabled
                  return (
                    <li key={session.id} className="group relative">
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
                          'w-full text-left px-3 py-2.5 rounded-lg text-[13px] leading-snug transition',
                          showDelete ? 'pr-9' : '',
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
                      {showDelete && (
                        <button
                          type="button"
                          onClick={(e) => onDeleteSession(session, e)}
                          className={cn(
                            'absolute right-1.5 top-1/2 -translate-y-1/2',
                            'h-7 w-7 grid place-items-center rounded-md',
                            'text-muted-foreground hover:text-primary hover:bg-black/[0.06]',
                            'opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity',
                          )}
                          aria-label={`Delete ${session.title}`}
                          title="Delete chat"
                        >
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-3 text-[12px] text-muted-foreground leading-relaxed">
                Your conversations will appear here.
              </p>
            )
          ) : (
            <div className="px-3">
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Create a free account to save your chats.
              </p>
              <Link
                href="/register"
                className="inline-block mt-2 text-[13px] text-foreground underline underline-offset-2 hover:text-primary transition"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>

        <div className="parle-chat-sidebar__footer">
          <div className="flex items-center gap-1.5 px-3 pb-3 text-[10px] text-muted-foreground">
            <Lock size={11} strokeWidth={2} aria-hidden />
            <span>Private by default</span>
          </div>

          {isAuthed && user ? (
            <div className="flex items-center gap-2 px-2 py-2 rounded-xl mx-1 hover:bg-black/[0.03] transition">
              <span className="parle-chat-sidebar__avatar" aria-hidden="true">
                {userInitial(user)}
              </span>
              <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">
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
            <div className="flex items-center gap-4 px-3 py-2 text-[13px]">
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
