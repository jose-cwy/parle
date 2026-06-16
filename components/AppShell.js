import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Home,
  MessageCircle,
  BookHeart,
  BookOpen,
  LogOut,
  Bookmark,
  Settings,
} from 'lucide-react'
import {
  clearAuthCache,
  fetchAuthUser,
  getCachedAuthUser,
  isAuthCacheReady,
  subscribeAuthUser,
} from '../lib/authSession'
import { cn } from '../lib/cn'
import HavenMark from './haven/HavenMark'
import { ParleSettingsPopup } from './haven/ParleSettings'

const NAV = [
  { href: '/dashboard', label: 'Home', mobileLabel: 'Home', icon: Home, exact: true },
  { href: '/chat', label: 'AI Chatbot', mobileLabel: 'Chat', icon: MessageCircle },
  { href: '/journal', label: 'Journal', mobileLabel: 'Journal', icon: BookHeart },
  { href: '/quotes', label: 'Quotes Book', mobileLabel: 'Quotes', icon: BookOpen, mobileIcon: Bookmark },
]

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function userInitial(user) {
  if (user?.preferred_name?.trim()) return user.preferred_name.trim().charAt(0).toUpperCase()
  const email = user?.email || ''
  return email.charAt(0).toUpperCase() || '?'
}

export default function AppShell({ children, hideRail = false }) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(getCachedAuthUser)
  const [authReady, setAuthReady] = useState(isAuthCacheReady)
  const [accountOpen, setAccountOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const accountRef = useRef(null)
  const expanded = hovered || pinned

  const closeAccount = useCallback(() => setAccountOpen(false), [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    NAV.forEach((item) => {
      router.prefetch(item.href)
    })
  }, [router])

  useEffect(() => {
    let active = true
    fetchAuthUser({ force: !isAuthCacheReady() })
      .then((authUser) => {
        if (!active) return
        setUser(authUser)
        setAuthReady(true)
      })
      .catch(() => {
        if (active) {
          setUser(getCachedAuthUser())
          setAuthReady(true)
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return subscribeAuthUser((authUser) => {
      setUser(authUser)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    closeAccount()
  }, [router.asPath, closeAccount])

  useEffect(() => {
    if (!accountOpen) return undefined
    function onPointerDown(e) {
      if (accountRef.current?.contains(e.target)) return
      closeAccount()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') closeAccount()
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen, closeAccount])

  async function handleLogout() {
    if (!user) return
    closeAccount()
    await fetch('/api/auth/logout', { method: 'POST' })
    clearAuthCache()
    router.push('/')
  }

  const showMobileChrome = authReady && user

  const rail = (
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'haven-shell__rail flex-col',
          expanded ? 'haven-shell__rail--expanded' : 'haven-shell__rail--collapsed',
        )}
      >
        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          className={cn('mb-2', expanded ? 'self-start' : 'self-center mx-auto')}
          aria-label={pinned ? 'Collapse navigation' : 'Pin navigation open'}
        >
          <HavenMark expanded={expanded} />
        </button>

        <div className="h-px bg-border/70 my-2" />

        <nav className="flex-1 flex flex-col gap-1.5 items-stretch" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(router.pathname, item)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center h-11 transition-colors duration-200',
                  expanded
                    ? 'rounded-2xl px-2.5'
                    : 'justify-center w-full',
                  expanded &&
                    (active
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'),
                  !expanded &&
                    (active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'),
                )}
                title={item.label}
              >
                {active && expanded && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-clay"
                  />
                )}
                <span
                  className={cn(
                    'haven-nav-icon-well shrink-0 grid place-items-center transition-colors duration-200',
                    expanded ? 'h-9 w-9' : 'h-10 w-10 rounded-full',
                    !expanded &&
                      (active
                        ? 'bg-secondary'
                        : 'group-hover:bg-secondary/60'),
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.6}
                    className={active ? 'text-clay' : 'group-hover:text-foreground'}
                  />
                </span>
                {expanded && (
                  <>
                    <span className="ml-1 text-[13.5px] font-medium tracking-tight whitespace-nowrap">
                      {item.label}
                    </span>
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rose" aria-hidden />
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {authReady && user ? (
          <>
            <div className="h-px bg-border/70 my-2" />

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={cn(
                'group relative flex items-center h-11 text-muted-foreground hover:text-foreground transition-colors',
                expanded ? 'rounded-2xl px-2.5 hover:bg-secondary/60' : 'justify-center w-full',
              )}
              title="Settings"
            >
              <span
                className={cn(
                  'haven-nav-icon-well shrink-0 grid place-items-center transition-colors duration-200',
                  expanded ? 'h-9 w-9' : 'h-10 w-10 rounded-full group-hover:bg-secondary/60',
                )}
              >
                <Settings size={17} strokeWidth={1.6} />
              </span>
              {expanded && (
                <span className="ml-1 text-[13.5px] font-medium whitespace-nowrap">Settings</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                'flex items-center h-11 text-muted-foreground hover:text-foreground transition-colors',
                expanded ? 'rounded-2xl px-2.5 hover:bg-secondary/60' : 'justify-center w-full',
              )}
              title="Log out"
            >
              <span
                className={cn(
                  'haven-nav-icon-well shrink-0 grid place-items-center transition-colors duration-200',
                  expanded ? 'h-9 w-9' : 'h-10 w-10 rounded-full hover:bg-secondary/60',
                )}
              >
                <LogOut size={17} strokeWidth={1.6} />
              </span>
              {expanded && (
                <span className="ml-1 text-[13.5px] font-medium whitespace-nowrap">Log out</span>
              )}
            </button>
          </>
        ) : null}
      </aside>
  )

  return (
    <div
      className={cn(
        'haven-shell min-h-screen w-full relative',
        hideRail && 'haven-shell--no-rail',
        showMobileChrome && 'haven-shell--has-mobile-chrome',
      )}
    >
      {mounted && !hideRail ? createPortal(rail, document.body) : null}

      {showMobileChrome && (
        <>
          <header className="haven-shell__mobile-header">
            <Link href="/dashboard" className="haven-shell__mobile-wordmark font-serif">
              parlé
            </Link>
            <div className="haven-shell__mobile-avatar-wrap" ref={accountRef}>
              <button
                type="button"
                className="haven-shell__mobile-avatar"
                onClick={() => setAccountOpen((open) => !open)}
                aria-label="Account menu"
                aria-expanded={accountOpen}
              >
                {userInitial(user)}
              </button>
              {accountOpen ? (
                <div className="haven-shell__mobile-account-menu" role="menu">
                  <button
                    type="button"
                    className="haven-shell__mobile-account-item"
                    role="menuitem"
                    onClick={() => {
                      closeAccount()
                      setSettingsOpen(true)
                    }}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    className="haven-shell__mobile-account-item haven-shell__mobile-account-item--logout"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <nav className="haven-shell__mobile-bottom-nav" aria-label="Primary">
            {NAV.map((item) => {
              const active = isActive(router.pathname, item)
              const Icon = item.mobileIcon || item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={cn(
                    'haven-shell__mobile-bottom-nav-item',
                    active && 'haven-shell__mobile-bottom-nav-item--active',
                  )}
                  aria-label={item.mobileLabel}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => {
                    if (active) e.preventDefault()
                  }}
                >
                  <Icon size={22} strokeWidth={active ? 2.25 : 1.6} fill={active ? 'currentColor' : 'none'} />
                  <span className="haven-shell__mobile-bottom-nav-label">{item.mobileLabel}</span>
                </Link>
              )
            })}
          </nav>
        </>
      )}

      {authReady && user ? (
        <ParleSettingsPopup
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          isAuthed={Boolean(user)}
        />
      ) : null}

      <main className="haven-shell__main">
        <div className="haven-shell__content">{children}</div>
      </main>
    </div>
  )
}
