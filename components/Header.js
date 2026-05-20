import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'

export default function Header(){
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const navLinks = user
    ? [
        { href: '/diary', label: 'Diary' },
        { href: '/chat', label: 'Chat' },
        { href: '/quotes', label: 'Quotes' },
      ]
    : []

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
      className="sticky top-0 z-30 w-full px-3 py-5"
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="container header-shell flex items-center justify-between gap-4">
        <Link href="/" className="brand-mark text-2xl font-semibold" aria-label="Heartstrings Club">Heartstrings Club</Link>
        <nav className="flex items-center gap-3 flex-wrap justify-end">
          {ready && user ? navLinks.map((link) => {
            const active = router.pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${active ? 'nav-link-active' : ''}`}
              >
                {link.label}
              </Link>
            )
          }) : null}
          {ready && !user ? (
            <>
              <Link href="/login" className="auth-pill">Log in</Link>
              <Link href="/register" className="auth-pill bg-[#b88957] text-white border-transparent">Sign up</Link>
            </>
          ) : null}
          {ready && user ? (
            <button onClick={handleLogout} className="auth-pill">Logout</button>
          ) : null}
        </nav>
      </div>
    </motion.header>
  )
}
