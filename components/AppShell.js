import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

const NAV = [
  { href: '/dashboard', label: 'Home' },
  { href: '/chat', label: 'Chat' },
  { href: '/letter-to-yourself', label: 'Letter' },
  { href: '/diary', label: 'Diary' },
  { href: '/quotes', label: 'Quotes' },
]

function isActive(pathname, href) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AppShell({ children }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className="app-shell-layout">
      <aside className={`app-shell-sidebar${menuOpen ? ' app-shell-sidebar--open' : ''}`}>
        <div className="app-shell-brand">
          <Link href="/dashboard" className="app-shell-brand-link">
            <span className="app-shell-brand-dot" aria-hidden="true" />
            Heartstrings
          </Link>
        </div>
        <nav id="app-shell-nav" className="app-shell-nav" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`app-shell-nav-link${isActive(router.pathname, item.href) ? ' app-shell-nav-link--active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button type="button" className="app-shell-logout" onClick={handleLogout}>
          Log out
        </button>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="app-shell-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="app-shell-main">
        <header className="app-shell-mobile-bar">
          <button
            type="button"
            className="app-shell-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="app-shell-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menu
          </button>
          <Link href="/dashboard" className="app-shell-mobile-title">
            Heartstrings
          </Link>
        </header>
        <div className="app-shell-content">{children}</div>
      </div>
    </div>
  )
}
