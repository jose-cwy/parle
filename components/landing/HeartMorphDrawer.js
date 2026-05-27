import { useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { journalPageReveal, journalContentStagger } from '../../lib/motion'
import { landingAssets } from '../../lib/landingAssets'

const TOOL_LINKS = [
  { id: 'chat', label: 'Chat', href: '/chat', vignettePos: '30% 40%' },
  { id: 'letter', label: 'Letter', href: '/letter-to-yourself', vignettePos: '55% 35%' },
  { id: 'diary', label: 'Diary', href: '/diary', vignettePos: '40% 60%' },
  { id: 'quotes', label: 'Quotes', href: '/quotes', vignettePos: '70% 50%' },
]

function HeartToggleIcon() {
  return (
    <svg
      className="journal-drawer__heart-icon"
      viewBox="0 0 24 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19.5c-4-3.5-8.5-7-8.5-11.2C3.5 5.2 6 3 8.8 3c1.6 0 3 .9 3.9 2.2C13.6 3.9 15 3 16.6 3 19.4 3 22 5.2 22 8.3c0 4.2-4.5 7.7-10 11.2Z" />
    </svg>
  )
}

export default function HeartMorphDrawer({ user, chatHref, open, onOpenChange }) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const panelRef = useRef(null)
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  useEffect(() => {
    if (open) {
      document.body.classList.add('body--nav-open')
    } else {
      document.body.classList.remove('body--nav-open')
    }
    return () => document.body.classList.remove('body--nav-open')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    close()
  }, [router.asPath, close])

  useEffect(() => {
    if (!open || !panelRef.current) return undefined
    const first = panelRef.current.querySelector('a, button')
    if (first) first.focus()
    return undefined
  }, [open])

  function handleAnchorClick() {
    close()
  }

  function toolHref(path) {
    return user ? path : `/login?next=${path}`
  }

  const panelVariants = reduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0 } },
        exit: { opacity: 0, transition: { duration: 0 } },
      }
    : journalPageReveal

  return (
    <div className="journal-drawer">
      <button
        type="button"
        className="journal-drawer__toggle"
        aria-expanded={open}
        aria-controls="journal-drawer-panel"
        aria-label={open ? 'Close journal menu' : 'Open journal menu'}
        onClick={() => onOpenChange(!open)}
      >
        {open ? (
          <span className="journal-drawer__toggle-close" aria-hidden="true">
            ×
          </span>
        ) : (
          <HeartToggleIcon />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              className="journal-drawer__scrim"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.3 }}
              onClick={close}
            />
            <motion.aside
              id="journal-drawer-panel"
              ref={panelRef}
              className="journal-drawer__panel"
              role="dialog"
              aria-modal="true"
              aria-label="Journal navigation"
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ perspective: 1200 }}
            >
              <div className="journal-drawer__paper-edge" aria-hidden="true" />
              <div className="journal-drawer__lamp-wash" aria-hidden="true" />

              <div className="journal-drawer__header-art">
                <Image
                  src={landingAssets.drawerJournalHeader}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 92vw, 420px"
                  className="journal-drawer__header-img"
                  priority
                />
                <div className="journal-drawer__header-glow" aria-hidden="true" />
              </div>

              <motion.div
                className="journal-drawer__content"
                variants={journalContentStagger.container}
                initial="hidden"
                animate="visible"
              >
                <motion.div variants={journalContentStagger.item}>
                  <button type="button" className="journal-drawer__close" onClick={close}>
                    Close
                  </button>
                </motion.div>

                <motion.p className="journal-drawer__label" variants={journalContentStagger.item}>
                  Your journal
                </motion.p>

                <motion.nav className="journal-drawer__tools" aria-label="Tools">
                  {TOOL_LINKS.map((tool) => (
                    <motion.div key={tool.id} variants={journalContentStagger.item}>
                      <Link
                        href={toolHref(tool.href)}
                        className="journal-drawer__tool-row"
                        onClick={close}
                      >
                        <span
                          className="journal-drawer__tool-vignette"
                          style={{
                            backgroundImage: `url(${landingAssets.heroDeskJournal})`,
                            backgroundPosition: tool.vignettePos,
                          }}
                          aria-hidden="true"
                        />
                        <span className="journal-drawer__tool-name">{tool.label}</span>
                      </Link>
                    </motion.div>
                  ))}
                </motion.nav>

                <motion.nav className="journal-drawer__links" aria-label="Page sections">
                  <motion.div variants={journalContentStagger.item}>
                    <a href="#how" onClick={handleAnchorClick}>
                      How it works
                    </a>
                  </motion.div>
                  <motion.div variants={journalContentStagger.item}>
                    <a href="#stories" onClick={handleAnchorClick}>
                      Stories
                    </a>
                  </motion.div>
                  {user ? (
                    <motion.div variants={journalContentStagger.item}>
                      <Link href="/dashboard" onClick={close}>
                        Dashboard
                      </Link>
                    </motion.div>
                  ) : (
                    <motion.div variants={journalContentStagger.item}>
                      <Link href="/login" onClick={close}>
                        Log in
                      </Link>
                    </motion.div>
                  )}
                  <motion.div variants={journalContentStagger.item}>
                    <Link href={chatHref} className="journal-drawer__cta" onClick={close}>
                      Talk it out
                    </Link>
                  </motion.div>
                </motion.nav>
              </motion.div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
