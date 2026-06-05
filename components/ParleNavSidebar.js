import Link from 'next/link'
import { useRouter } from 'next/router'

function guestHref(path) {
  return `/login?next=${encodeURIComponent(path)}`
}

export default function ParleNavSidebar({ open, onClose, user, onLogout }) {
  const router = useRouter()

  function handleNav(href) {
    onClose()
    router.push(href)
  }

  function handleProtected(path) {
    onClose()
    router.push(user ? path : guestHref(path))
  }

  const initial = user?.name?.trim()?.[0]?.toUpperCase() || user?.email?.trim()?.[0]?.toUpperCase() || '?'

  return (
    <>
      <button
        type="button"
        className={`parle-sidebar__scrim${open ? ' parle-sidebar__scrim--visible' : ''}`}
        onClick={onClose}
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
      />

      <aside
        id="parle-sidebar"
        className={`parle-sidebar${open ? ' parle-sidebar--open' : ''}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="parle-sidebar__close"
          onClick={onClose}
          aria-label="Close menu"
        >
          ×
        </button>

        <nav className="parle-sidebar__nav" aria-label="Main">
          <button type="button" className="parle-sidebar__link" onClick={() => handleNav('/chat')}>
            Talk it through
          </button>
          <button type="button" className="parle-sidebar__link" onClick={() => handleProtected('/quotes')}>
            Quotes
          </button>
          <button type="button" className="parle-sidebar__link" onClick={() => handleProtected('/journal')}>
            Journal
          </button>

          <hr className="parle-sidebar__divider" />

          {user ? (
            <>
              <div className="parle-sidebar__user">
                <span className="parle-sidebar__avatar" aria-hidden="true">{initial}</span>
                <span className="parle-sidebar__user-label">{user.name || user.email}</span>
              </div>
              <button type="button" className="parle-sidebar__auth-link" onClick={onLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="parle-sidebar__auth-link" onClick={onClose}>
                Login
              </Link>
              <Link href="/register" className="parle-sidebar__signup" onClick={onClose}>
                Sign up
              </Link>
            </>
          )}

          <hr className="parle-sidebar__divider" />

          <Link href="/terms" className="parle-sidebar__terms" onClick={onClose}>
            Terms &amp; Conditions
          </Link>
        </nav>
      </aside>
    </>
  )
}
