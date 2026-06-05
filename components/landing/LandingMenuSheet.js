import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'

function MenuButton({ children, variant = 'outline', onClick, href }) {
  const className = `lf-menu-btn lf-menu-btn--${variant}`

  if (href) {
    return (
      <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
        <Link href={href} className={className} onClick={onClick}>
          {children}
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}>
      <button type="button" className={className} onClick={onClick}>
        {children}
      </button>
    </motion.div>
  )
}

export default function LandingMenuSheet({ open, onClose, user, onLogout }) {
  const router = useRouter()

  function navigate(href) {
    onClose()
    router.push(href)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="lf-sheet__overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-label="Close menu"
          />

          <motion.aside
            className="lf-sheet__panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <button
              type="button"
              className="lf-sheet__close"
              onClick={onClose}
              aria-label="Close menu"
            >
              ×
            </button>

            <h2 className="lf-sheet__title lf-serif">Menu</h2>

            <motion.nav
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="lf-sheet__nav"
            >
              {!user ? (
                <>
                  <MenuButton href="/login" onClick={onClose}>Login</MenuButton>
                  <MenuButton href="/register" onClick={onClose}>Sign Up</MenuButton>
                  <MenuButton variant="primary" onClick={() => navigate('/chat')}>
                    Try Chatbot
                  </MenuButton>
                </>
              ) : (
                <>
                  <MenuButton onClick={() => navigate('/dashboard')}>Dashboard</MenuButton>
                  <MenuButton onClick={() => navigate('/chat')}>Chatbot</MenuButton>
                  <MenuButton onClick={() => navigate('/journal')}>Journal</MenuButton>
                  <MenuButton variant="destructive" onClick={onLogout}>Logout</MenuButton>
                </>
              )}
            </motion.nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
