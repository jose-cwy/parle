import Link from 'next/link'
import { Lock, Menu, Settings, SquarePen, Trash2, X } from 'lucide-react'
import { cn } from '../../lib/cn'

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
  onNewChat,
  onSelectSession,
  onDeleteSession,
}) {
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
            <Link href="/" className="parle-chat-sidebar__back">
              ← back
            </Link>
            <span className="parle-chat-sidebar__wordmark font-serif text-[1.35rem] leading-none text-foreground tracking-tight">
              parlé
            </span>
            <button
              type="button"
              className="md:hidden ml-auto h-8 w-8 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.04] transition"
              aria-label="Close menu"
              onClick={onCloseMobile}
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>

          <button
            type="button"
            onClick={onNewChat}
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
                        onClick={() => !disabled && onSelectSession(session)}
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
              <span className="h-8 w-8 shrink-0 rounded-full bg-primary/15 text-primary text-[13px] font-medium grid place-items-center">
                {userInitial(user)}
              </span>
              <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">
                {userDisplayName(user)}
              </span>
              <Link
                href="/dashboard"
                className="h-8 w-8 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground transition"
                aria-label="Settings"
                title="Settings"
              >
                <Settings size={16} strokeWidth={1.75} />
              </Link>
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
    </>
  )
}

export function ParleChatMobileMenuButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="parle-chat-main__menu-btn md:hidden"
      aria-label="Open chat menu"
    >
      <Menu size={20} strokeWidth={1.75} />
    </button>
  )
}
