import { useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { spring, stagger } from '../../lib/motion'

/** Smooth 808s-style heart outline (viewBox 0 0 200 180) */
const HEART_OUTLINE =
  'M100 158 C100 158 28 108 28 68 C28 46 48 34 72 34 C88 34 96 46 100 56 C104 46 112 34 128 34 C152 34 172 46 172 68 C172 108 100 158 100 158 Z'

const TOOL_NODES = [
  { id: 'chat', label: 'Chat', cx: 52, cy: 52, href: '/chat' },
  { id: 'letter', label: 'Letter', cx: 148, cy: 52, href: '/letter-to-yourself' },
  { id: 'diary', label: 'Diary', cx: 68, cy: 132, href: '/diary' },
  { id: 'quotes', label: 'Quotes', cx: 132, cy: 132, href: '/quotes' },
]

function HeartIcon({ className, filled }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.25c-3.5-3.1-7.5-6.2-7.5-10.1C4.5 6.6 7.1 4.5 9.75 4.5c1.5 0 2.9.8 3.75 2.05C14.35 5.3 15.75 4.5 17.25 4.5 19.9 4.5 22.5 6.6 22.5 10.15 22.5 14.05 18.5 17.15 12 20.25Z" />
    </svg>
  )
}

export default function HeartMapDrawer({ user, chatHref, open, onOpenChange }) {
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

  const drawerTransition = reduceMotion
    ? { duration: 0 }
    : { ...spring.gentle }

  return (
    <div className="heart-map-nav">
      <button
        type="button"
        className="heart-map-nav__toggle"
        aria-expanded={open}
        aria-controls="heart-map-nav-panel"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => onOpenChange(!open)}
      >
        <HeartIcon className="heart-map-nav__toggle-icon" filled={open} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              className="heart-map-nav__scrim"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
              onClick={close}
            />
            <motion.aside
              id="heart-map-nav-panel"
              ref={panelRef}
              className="heart-map-nav__drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={drawerTransition}
            >
              <button
                type="button"
                className="heart-map-nav__close"
                onClick={close}
              >
                Close
              </button>

              <div className="heart-map-nav__map-wrap">
                <motion.svg
                  className="heart-map-nav__heart-svg"
                  viewBox="0 0 200 180"
                  aria-hidden="true"
                  initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...spring.gentle, delay: reduceMotion ? 0 : 0.08 }}
                >
                  <path
                    className="heart-map-nav__heart-fill"
                    d={HEART_OUTLINE}
                  />
                  <path
                    className="heart-map-nav__heart-stroke"
                    d={HEART_OUTLINE}
                    fill="none"
                  />
                  {/* Red threads from center to nodes */}
                  {TOOL_NODES.map((node) => (
                    <line
                      key={`line-${node.id}`}
                      className="heart-map-nav__thread-line"
                      x1="100"
                      y1="78"
                      x2={node.cx}
                      y2={node.cy}
                    />
                  ))}
                </motion.svg>

                {TOOL_NODES.map((node, i) => (
                  <motion.div
                    key={node.id}
                    className="heart-map-nav__node"
                    style={{
                      left: `${(node.cx / 200) * 100}%`,
                      top: `${(node.cy / 180) * 100}%`,
                    }}
                    initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      ...spring.gentle,
                      delay: reduceMotion ? 0 : 0.12 + i * 0.06,
                    }}
                  >
                    <Link
                      href={toolHref(node.href)}
                      className="heart-map-nav__node-link"
                      onClick={close}
                    >
                      <span className="heart-map-nav__node-dot" aria-hidden="true" />
                      <span className="heart-map-nav__node-label">{node.label}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>

              <motion.nav
                className="heart-map-nav__links"
                aria-label="Page sections"
                variants={stagger.container}
                initial="initial"
                animate="animate"
              >
                <motion.div variants={stagger.item}>
                  <a href="#how" onClick={handleAnchorClick}>
                    How it works
                  </a>
                </motion.div>
                <motion.div variants={stagger.item}>
                  <a href="#stories" onClick={handleAnchorClick}>
                    Stories
                  </a>
                </motion.div>
                {user ? (
                  <motion.div variants={stagger.item}>
                    <Link href="/dashboard" onClick={close}>
                      Dashboard
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div variants={stagger.item}>
                    <Link href="/login" onClick={close}>
                      Log in
                    </Link>
                  </motion.div>
                )}
                <motion.div variants={stagger.item}>
                  <Link href={chatHref} className="heart-map-nav__cta" onClick={close}>
                    Talk it out
                  </Link>
                </motion.div>
              </motion.nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
