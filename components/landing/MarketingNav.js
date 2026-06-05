import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <line x1="3" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function MarketingNav({ user = null, ready = true, onLogout }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const close = () => setOpen(false)
  const isRegister = router.pathname === '/register'
  const isLogin = router.pathname === '/login'
  const homeHref = user ? '/dashboard' : '/'

  useEffect(() => {
    setOpen(false)
  }, [router.asPath])

  useEffect(() => {
    if (open) {
      document.body.classList.add('body--nav-open')
    } else {
      document.body.classList.remove('body--nav-open')
    }
    return () => document.body.classList.remove('body--nav-open')
  }, [open])

  return (
    <nav className="pss-nav sticky top-0 z-40">
      <div className="pss-nav__inner">
        <Link href={homeHref} className="pss-nav-logo font-serif text-2xl">
          parlé
        </Link>

        <div className="pss-nav__actions">
          {ready && !user && (
            <>
              {isRegister ? (
                <Link href="/login" className="pss-nav-link hidden sm:inline-flex">
                  Log in
                </Link>
              ) : (
                <Link href="/register" className="pss-nav-cta hidden sm:inline-flex">
                  Start free
                </Link>
              )}
            </>
          )}
          {ready && user && (
            <Link href="/dashboard" className="pss-nav-link hidden sm:inline-flex">
              Dashboard
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="pss-nav__menu-btn"
            aria-label="Menu"
            aria-expanded={open}
          >
            <HamburgerIcon />
          </button>
        </div>
      </div>

      {open ? (
        <div className="pss-nav-menu pss-menu-enter">
          <div className="pss-nav__inner pss-nav-menu__links">
            {!user ? (
              <>
                <Link href="/#what" className="pss-nav-menu__link" onClick={close}>
                  What is parlé
                </Link>
                <Link href="/#how" className="pss-nav-menu__link" onClick={close}>
                  How it works
                </Link>
                <Link href="/#voices" className="pss-nav-menu__link" onClick={close}>
                  Voices
                </Link>
                <Link href="/chat" className="pss-nav-menu__link" onClick={close}>
                  Start talking
                </Link>
                {!isLogin && (
                  <Link href="/login" className="pss-nav-menu__link" onClick={close}>
                    Log in
                  </Link>
                )}
                {!isRegister && (
                  <Link href="/register" className="pss-nav-menu__link" onClick={close}>
                    Sign up
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/dashboard" className="pss-nav-menu__link" onClick={close}>
                  Dashboard
                </Link>
                <Link href="/chat" className="pss-nav-menu__link" onClick={close}>
                  Chat
                </Link>
                <Link href="/journal" className="pss-nav-menu__link" onClick={close}>
                  Journal
                </Link>
                <button type="button" className="pss-nav-menu__link pss-nav-menu__link--btn" onClick={onLogout}>
                  Log out
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  )
}
