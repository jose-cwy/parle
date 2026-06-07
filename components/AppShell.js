import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Home,
  MessageCircle,
  BookHeart,
  BookOpen,
  LogOut,
} from 'lucide-react'
import { cn } from '../lib/cn'
import HavenMark from './haven/HavenMark'

const NAV = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/chat', label: 'AI Chatbot', icon: MessageCircle },
  { href: '/journal', label: 'Journal', icon: BookHeart },
  { href: '/quotes', label: 'Quotes Book', icon: BookOpen },
]

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function AppShell({ children, hideRail = false }) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const expanded = hovered || pinned

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!active) return
        if (res.ok) {
          const payload = await res.json()
          setUser(payload.user || null)
        } else {
          setUser(null)
        }
        setAuthReady(true)
      })
      .catch(() => {
        if (active) {
          setUser(null)
          setAuthReady(true)
        }
      })
    return () => {
      active = false
    }
  }, [router.asPath])

  async function handleLogout() {
    if (!user) return
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

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
      )}
    >
      {mounted && !hideRail ? createPortal(rail, document.body) : null}

      {!hideRail && (
      <header className="haven-shell__mobile-header md:hidden">
        <HavenMark expanded />
        <nav className="flex items-center gap-1" aria-label="Mobile">
          {NAV.map((item) => {
            const active = isActive(router.pathname, item)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'h-9 w-9 grid place-items-center rounded-xl',
                  active ? 'bg-secondary text-clay' : 'text-muted-foreground',
                )}
                aria-label={item.label}
              >
                <Icon size={17} strokeWidth={1.6} />
              </Link>
            )
          })}
        </nav>
      </header>
      )}

      <main className="haven-shell__main">
        <div className="haven-shell__content">{children}</div>
      </main>
    </div>
  )
}
