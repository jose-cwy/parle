import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BookOpen, MessageCircle, Quote } from 'lucide-react'
import { ease, spring } from '../../lib/motion'
import AuthButtons from './AuthButtons'
import HeartLogo from './HeartLogo'
import MenuFeatureCard from './MenuFeatureCard'

function safeHref(user, path) {
  return user ? path : `/login?next=${path}`
}

function HeartstringsMenuButton({ open, onToggle, controlsId }) {
  const reduceMotion = useReducedMotion()

  const pathCommon = {
    stroke: 'currentColor',
    strokeWidth: 2.25,
    strokeLinecap: 'round',
    fill: 'none',
  }

  const top = {
    closed: { rotate: 0, y: 0, opacity: 1 },
    open: { rotate: 42, y: 6.2, opacity: 1 },
  }
  const mid = {
    closed: { opacity: 1, scaleX: 1 },
    open: { opacity: 0, scaleX: 0.6 },
  }
  const bot = {
    closed: { rotate: 0, y: 0, opacity: 1 },
    open: { rotate: -42, y: -6.2, opacity: 1 },
  }

  return (
    <motion.button
      type="button"
      className="heartstringsMenu__toggle"
      aria-expanded={open}
      aria-controls={controlsId}
      aria-label={open ? 'Close menu' : 'Open menu'}
      onClick={onToggle}
      whileHover={reduceMotion ? undefined : { rotate: open ? 0 : -1, scale: 1.03 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={spring.breath}
    >
      <motion.svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        className="heartstringsMenu__icon"
        aria-hidden="true"
      >
        {/* Threads (curved lines) */}
        <motion.path
          {...pathCommon}
          d="M7.2 11.2 C 13.0 8.2, 20.6 8.2, 26.8 11.2"
          variants={top}
          animate={open ? 'open' : 'closed'}
          transformOrigin="17px 17px"
          transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: ease.out }}
        />
        <motion.path
          {...pathCommon}
          d="M7.2 17.0 C 13.0 14.0, 20.6 14.0, 26.8 17.0"
          variants={mid}
          animate={open ? 'open' : 'closed'}
          transformOrigin="17px 17px"
          transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: ease.out }}
        />
        <motion.path
          {...pathCommon}
          d="M7.2 22.8 C 13.0 25.8, 20.6 25.8, 26.8 22.8"
          variants={bot}
          animate={open ? 'open' : 'closed'}
          transformOrigin="17px 17px"
          transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: ease.out }}
        />

        {/* Tiny heart charm */}
        <motion.path
          d="M26.2 12.4c0-1 .8-1.8 1.8-1.8.6 0 1.2.3 1.5.8.3-.5.9-.8 1.5-.8 1 0 1.8.8 1.8 1.8 0 1.4-1.2 2.5-3.3 4.2-2.1-1.7-3.3-2.8-3.3-4.2Z"
          fill="rgba(212,129,143,0.85)"
          opacity="0.9"
          initial={false}
          animate={open ? { scale: 0.9, opacity: 0.6 } : { scale: 1, opacity: 0.92 }}
          transformOrigin="29px 13px"
          transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: ease.out }}
        />
      </motion.svg>
    </motion.button>
  )
}

export default function HeartstringsMenu({ user, open, onOpenChange }) {
  const reduceMotion = useReducedMotion()
  const id = useId()
  const controlsId = `heartstrings-menu-panel-${id}`
  const panelRef = useRef(null)

  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const toggle = useCallback(() => onOpenChange(!open), [onOpenChange, open])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (open) {
      document.body.classList.add('body--nav-open')
    } else {
      document.body.classList.remove('body--nav-open')
    }
    return () => document.body.classList.remove('body--nav-open')
  }, [open])

  useEffect(() => {
    if (!open || !panelRef.current) return undefined
    const first = panelRef.current.querySelector('a, button')
    if (first) first.focus()
    return undefined
  }, [open])

  const cards = useMemo(
    () => [
      {
        key: 'chat',
        icon: MessageCircle,
        title: 'Talk it through',
        description: 'Chat with an AI that listens without judgment.',
        href: safeHref(user, '/chat'),
      },
      {
        key: 'quotes',
        icon: Quote,
        title: 'Quotes book',
        description: 'Find words when yours are heavy.',
        href: safeHref(user, '/quotes'),
      },
      {
        key: 'diary',
        icon: BookOpen,
        title: 'Diary',
        description: 'Keep what you feel private.',
        href: safeHref(user, '/diary'),
      },
    ],
    [user]
  )

  return (
    <div className="heartstringsMenu">
      <HeartstringsMenuButton open={open} onToggle={toggle} controlsId={controlsId} />

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              className="heartstringsMenu__scrim"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: ease.out }}
              onClick={close}
            />

            <motion.aside
              id={controlsId}
              ref={panelRef}
              className="heartstringsMenu__panel"
              role="dialog"
              aria-modal="true"
              aria-label="Heartstrings menu"
              initial={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -8, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98, filter: 'blur(10px)' }}
              transition={reduceMotion ? { duration: 0 } : { ...spring.modal, opacity: { duration: 0.18 } }}
            >
              <div className="heartstringsMenu__panelTop">
                <div className="heartstringsMenu__brand">
                  <HeartLogo size={22} />
                  <div className="heartstringsMenu__brandText">
                    <p className="heartstringsMenu__label">Your journal</p>
                    <p className="heartstringsMenu__brandName">Heartstrings Club</p>
                  </div>
                </div>
                <button type="button" className="heartstringsMenu__close" onClick={close}>
                  Close
                </button>
              </div>

              <div className="heartstringsMenu__cards" aria-label="Features">
                {cards.map((c, i) => (
                  <MenuFeatureCard
                    key={c.key}
                    href={c.href}
                    icon={c.icon}
                    title={c.title}
                    description={c.description}
                    index={i}
                    onClick={close}
                  />
                ))}
              </div>

              <div className="heartstringsMenu__auth">
                <p className="heartstringsMenu__authNote">Ready when you are.</p>
                <AuthButtons variant="menu" />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

