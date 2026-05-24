import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, useScroll, useTransform } from 'framer-motion'
import SkeletonBlock from './Skeleton'
import { spring, hoverGlow } from '../lib/motion'

export default function Header(){
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const isJourney = router.pathname === '/'

  const navLinks = user
    ? [
        { href: '/letter-to-yourself', label: 'Letter' },
        { href: '/diary', label: 'Diary' },
        { href: '/chat', label: 'Chat' },
        { href: '/quotes', label: 'Quotes' },
      ]
    : []

  // On the journey landing, header stays transparent until scrolled past hero
  const { scrollY } = useScroll()
  const headerBg = useTransform(
    scrollY,
    [0, 80],
    isJourney
      ? ['rgba(31,24,20,0)', 'rgba(31,24,20,0.88)']
      : ['rgba(45,35,28,0.82)', 'rgba(45,35,28,0.82)']
  )
  const headerBorder = useTransform(
    scrollY,
    [0, 80],
    isJourney
      ? ['rgba(232,168,96,0)', 'rgba(232,168,96,0.16)']
      : ['rgba(232,168,96,0.16)', 'rgba(232,168,96,0.16)']
  )

  useEffect(()=>{
    setReady(false)
    let active = true
    fetch('/api/auth/me')
      .then(async (res) => {
        if(!active) return
        if(res.ok){
          const payload = await res.json()
          setUser(payload.user || null)
        }
        setReady(true)
      })
      .catch(()=>{
        if(active) setReady(true)
      })
    return () => { active = false }
  },[router.asPath])

  async function handleLogout(){
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
  }

  return (
    <motion.header
      className="sticky top-0 z-30 w-full px-3 py-3"
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      <motion.div
        className="container flex items-center justify-between gap-4 rounded-[999px] px-5 py-3"
        style={{
          background: headerBg,
          borderColor: headerBorder,
          border: '1.5px solid',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <Link href="/" className="brand-mark text-xl font-semibold text-[var(--text)] cursor-pointer flex items-center gap-2" aria-label="Heartstrings Club">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-teal)] shadow-[0_0_10px_var(--accent-teal-glow)]" aria-hidden="true" />
          Heartstrings Club
        </Link>
        <nav className="flex items-center gap-2 flex-wrap justify-end min-h-[2.5rem]">
          {!ready ? (
            <>
              <SkeletonBlock className="h-9 w-20 hidden sm:block" rounded="rounded-full" />
              <SkeletonBlock className="h-9 w-24" rounded="rounded-full" />
            </>
          ) : null}
          {ready && user ? navLinks.map((link) => {
            const active = router.pathname === link.href
            return (
              <motion.div key={link.href} {...hoverGlow}>
                <Link
                  href={link.href}
                  className={`nav-link cursor-pointer ${active ? 'nav-link-active' : ''}`}
                >
                  {link.label}
                </Link>
              </motion.div>
            )
          }) : null}
          {ready && !user ? (
            <>
              <Link href="/login" className="auth-pill cursor-pointer">Log in</Link>
              <Link href="/register" className="auth-pill soft-button-primary border-transparent cursor-pointer">Sign up</Link>
            </>
          ) : null}
          {ready && user ? (
            <motion.button onClick={handleLogout} className="auth-pill cursor-pointer" {...hoverGlow}>
              Logout
            </motion.button>
          ) : null}
        </nav>
      </motion.div>
    </motion.header>
  )
}
