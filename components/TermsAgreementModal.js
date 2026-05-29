import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  SAFETY_AGREEMENT_INTRO,
  safetyAgreementSections,
} from '../data/safetyAgreementContent'
import { SkeletonButton } from './loading'
import { spring } from '../lib/motion'

const SCROLL_THRESHOLD = 12
const BOTTOM_CONFIRM_MS = 140

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function SectionArrow() {
  return (
    <span className="terms-agreement-modal__arrow" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
        <path
          d="M2.5 8h9M8.5 5l3 3-3 3"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function BorderCharm({ className }) {
  return (
    <span className={`terms-agreement-modal__charm ${className}`} aria-hidden="true">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
        <path
          d="M10 16.2C7.2 13.6 5.2 11.6 5.2 9.2C5.2 7.4 6.6 6 8.4 6C9.4 6 10.2 6.5 10.6 7.3C11 6.5 11.8 6 12.8 6C14.6 6 16 7.4 16 9.2C16 11.6 14 13.6 10 16.2Z"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 10h12"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </span>
  )
}

export default function TermsAgreementModal({
  open = true,
  accepting = false,
  onAccept,
}) {
  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef(null)
  const scrollRef = useRef(null)
  const previousFocusRef = useRef(null)
  const reachBottomTimerRef = useRef(null)
  const scrollRafRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  const [hasReachedBottom, setHasReachedBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  const canAccept = hasReachedBottom && agreed && !accepting

  const readScrollState = useCallback(() => {
    const node = scrollRef.current
    if (!node) return null

    const { scrollTop, scrollHeight, clientHeight } = node
    const scrollable = scrollHeight - clientHeight > 12
    const maxScroll = Math.max(scrollHeight - clientHeight, 0)
    const progress = scrollable ? Math.min(1, scrollTop / maxScroll) : 1
    const distanceFromBottom = scrollHeight - clientHeight - scrollTop
    const atBottomNow =
      !scrollable ||
      (distanceFromBottom <= SCROLL_THRESHOLD && progress >= 0.985)

    return { scrollable, progress, atBottomNow }
  }, [])

  const applyScrollState = useCallback(
    (immediate = false) => {
      const state = readScrollState()
      if (!state) return

      setScrollProgress(state.progress)

      if (reachBottomTimerRef.current) {
        clearTimeout(reachBottomTimerRef.current)
        reachBottomTimerRef.current = null
      }

      if (!state.atBottomNow) {
        setHasReachedBottom(false)
        setAgreed(false)
        return
      }

      if (immediate) {
        setHasReachedBottom(true)
        return
      }

      reachBottomTimerRef.current = window.setTimeout(() => {
        const latest = readScrollState()
        if (latest?.atBottomNow) {
          setHasReachedBottom(true)
        }
      }, BOTTOM_CONFIRM_MS)
    },
    [readScrollState],
  )

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      applyScrollState(false)
    })
  }, [applyScrollState])

  useLayoutEffect(() => {
    if (!open) return undefined

    function syncNavbarHeight() {
      const header = document.querySelector('.marketing-header')
      const height = header?.getBoundingClientRect().height
      if (height && height > 0) {
        document.documentElement.style.setProperty(
          '--hs-navbar-height',
          `${Math.ceil(height)}px`,
        )
      }
    }

    syncNavbarHeight()
    window.addEventListener('resize', syncNavbarHeight)
    return () => {
      window.removeEventListener('resize', syncNavbarHeight)
    }
  }, [open])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setHasReachedBottom(false)
      setAgreed(false)
      setScrollProgress(0)
      if (reachBottomTimerRef.current) {
        clearTimeout(reachBottomTimerRef.current)
      }
      return undefined
    }

    previousFocusRef.current = document.activeElement

    const runCheck = () => applyScrollState(true)

    const t1 = window.setTimeout(runCheck, 60)
    const t2 = window.setTimeout(runCheck, 220)

    const node = scrollRef.current
    let observer
    if (node && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => applyScrollState(true))
      observer.observe(node)
    }

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      observer?.disconnect()
      if (reachBottomTimerRef.current) {
        clearTimeout(reachBottomTimerRef.current)
      }
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [open, applyScrollState])

  useEffect(() => {
    if (!open) return undefined
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      previousFocusRef.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = getFocusableElements(dialogRef.current)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!open || !mounted) return null

  const modal = (
    <motion.div
      className="terms-agreement-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
      role="presentation"
    >
      <div className="terms-agreement-modal__shell">
        <div className="terms-agreement-modal__ornaments" aria-hidden="true">
          <BorderCharm className="terms-agreement-modal__charm--tl" />
          <BorderCharm className="terms-agreement-modal__charm--br" />
        </div>

        <motion.div
          ref={dialogRef}
          className="terms-agreement-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={spring.gentle}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="terms-agreement-modal__header">
            <p className="terms-agreement-modal__eyebrow">Terms &amp; Safety Agreement</p>
          <h2 id={titleId} className="terms-agreement-modal__title">
            {SAFETY_AGREEMENT_INTRO.title}
          </h2>
          <p id={descId} className="terms-agreement-modal__subtitle">
            {SAFETY_AGREEMENT_INTRO.subtitle}
          </p>
          <div className="terms-agreement-modal__progress" aria-hidden>
              <div
                className="terms-agreement-modal__progress-bar"
                style={{ width: `${Math.round(scrollProgress * 100)}%` }}
              />
            </div>
          </header>

          <div
            ref={scrollRef}
            className="terms-agreement-modal__body"
            tabIndex={0}
            onScroll={handleScroll}
            aria-label="Terms and safety agreement text"
          >
            <div className="terms-agreement-modal__sections">
              {safetyAgreementSections.map((section) => (
                <section key={section.id} className="terms-agreement-modal__section">
                  <div className="terms-agreement-modal__section-head">
                    <SectionArrow />
                    <h3>{section.title}</h3>
                  </div>
                  <div className="terms-agreement-modal__prose">
                    {section.body.map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <footer className="terms-agreement-modal__footer">
            <label
              className={`terms-agreement-modal__checkbox${hasReachedBottom ? '' : ' terms-agreement-modal__checkbox--locked'}`}
            >
              <input
                type="checkbox"
                checked={agreed}
                disabled={!hasReachedBottom || accepting}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>{SAFETY_AGREEMENT_INTRO.checkboxLabel}</span>
            </label>

            <div className="terms-agreement-modal__actions">
              {accepting ? (
                <SkeletonButton className="h-11 w-full" rounded="rounded-xl" />
              ) : (
                <button
                  type="button"
                  className="terms-agreement-modal__btn terms-agreement-modal__btn--accept"
                  onClick={onAccept}
                  disabled={!canAccept}
                >
                  {SAFETY_AGREEMENT_INTRO.acceptLabel}
                </button>
              )}
            </div>
          </footer>
        </motion.div>
      </div>
    </motion.div>
  )

  return createPortal(modal, document.body)
}
