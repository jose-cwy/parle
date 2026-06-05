import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  SAFETY_AGREEMENT_INTRO,
  safetyAgreementSections,
} from '../data/safetyAgreementContent'
import { SkeletonButton } from '../components/loading'

function SectionArrow() {
  return (
    <span className="pss-terms-page__arrow" aria-hidden="true">
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

export default function TermsPage() {
  const [hasReachedBottom, setHasReachedBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [accepting, setAccepting] = useState(false)
  const scrollRef = useRef(null)
  const router = useRouter()

  const canAccept = hasReachedBottom && agreed && !accepting

  const handleScroll = useCallback(() => {
    const node = scrollRef.current
    if (!node) return

    const { scrollTop, scrollHeight, clientHeight } = node
    const maxScroll = scrollHeight - clientHeight
    setScrollProgress(maxScroll <= 0 ? 1 : Math.min(1, scrollTop / maxScroll))

    if (scrollTop + clientHeight >= scrollHeight - 24) {
      setHasReachedBottom(true)
    }
  }, [])

  async function handleAccept() {
    if (!canAccept) return

    setAccepting(true)
    const res = await fetch('/api/auth/terms-accept', { method: 'POST' })
    if (res.ok) {
      router.push('/register')
      return
    }

    setAccepting(false)
    alert('Unable to record your acceptance right now. Please try again.')
  }

  return (
    <>
      <Head>
        <title>Terms &amp; Safety — parlé</title>
        <meta
          name="description"
          content="Read the parlé Terms & Safety Agreement before creating your account."
        />
      </Head>
      <main className="pss-terms-page">
      <div className="pss-terms-page__wrap">
        <article className="pss-terms-page__card">
          <header className="pss-terms-page__header">
            <p className="pss-terms-page__eyebrow">Terms &amp; Safety Agreement</p>
            <h1 className="pss-terms-page__title">{SAFETY_AGREEMENT_INTRO.title}</h1>
            <p className="pss-terms-page__subtitle">{SAFETY_AGREEMENT_INTRO.subtitle}</p>
            <div className="pss-terms-page__progress" aria-hidden="true">
              <div
                className="pss-terms-page__progress-bar"
                style={{ width: `${Math.round(scrollProgress * 100)}%` }}
              />
            </div>
          </header>

          <div
            ref={scrollRef}
            className="pss-terms-page__body"
            tabIndex={0}
            onScroll={handleScroll}
            aria-label="Terms and safety agreement text"
          >
            <div className="pss-terms-page__sections">
              {safetyAgreementSections.map((section) => (
                <section key={section.id} className="pss-terms-page__section">
                  <div className="pss-terms-page__section-head">
                    <SectionArrow />
                    <h2>{section.title}</h2>
                  </div>
                  <div className="pss-terms-page__prose">
                    {section.body.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <footer className="pss-terms-page__footer">
            <label
              className={`pss-terms-page__checkbox${hasReachedBottom ? '' : ' pss-terms-page__checkbox--locked'}`}
            >
              <input
                type="checkbox"
                checked={agreed}
                disabled={!hasReachedBottom || accepting}
                onChange={(event) => setAgreed(event.target.checked)}
              />
              <span>{SAFETY_AGREEMENT_INTRO.checkboxLabel}</span>
            </label>

            <div className="pss-terms-page__actions">
              {accepting ? (
                <SkeletonButton className="h-11 w-full" rounded="rounded-full" />
              ) : (
                <button
                  type="button"
                  className="pss-terms-page__accept"
                  onClick={handleAccept}
                  disabled={!canAccept}
                >
                  {SAFETY_AGREEMENT_INTRO.acceptLabel}
                </button>
              )}
            </div>

            <p className="pss-terms-page__links">
              <Link href="/register">Back to signup</Link>
              <span aria-hidden="true">·</span>
              <Link href="/">Home</Link>
              <span aria-hidden="true">·</span>
              <Link href="/contact">Contact</Link>
            </p>
          </footer>
        </article>
      </div>

      <footer className="pss-terms-page__site-footer">
        <span className="pss-terms-page__site-mark">parlé</span>
        <span aria-hidden="true">·</span>
        <span>A quiet space, always open.</span>
      </footer>
    </main>
    </>
  )
}
