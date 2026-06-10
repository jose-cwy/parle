import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Head from 'next/head'
import { safetyAgreementSections } from '../data/safetyAgreementContent'

function TermsReadingProgress({ progress }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const percent = Math.round(progress * 100)

  return createPortal(
    <div
      className="pss-terms-page__progress-rail"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        className="pss-terms-page__progress-bar"
        style={{ width: `${percent}%` }}
      />
    </div>,
    document.body,
  )
}

export default function TermsPage() {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    document.documentElement.classList.add('html--terms-page')
    document.body.classList.add('body--terms-page')

    function syncNavHeight() {
      const header =
        document.querySelector('.pss-nav') || document.querySelector('.marketing-header')
      const height = header?.getBoundingClientRect().height
      if (height && height > 0) {
        const px = `${Math.ceil(height)}px`
        document.documentElement.style.setProperty('--pss-nav-height', px)
        document.documentElement.style.setProperty('--hs-navbar-height', px)
      }
    }

    function updateScrollState() {
      const doc = document.documentElement
      const maxScroll = doc.scrollHeight - window.innerHeight
      setScrollProgress(maxScroll <= 0 ? 1 : Math.min(1, window.scrollY / maxScroll))
    }

    function onResize() {
      syncNavHeight()
      updateScrollState()
    }

    syncNavHeight()
    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      document.documentElement.classList.remove('html--terms-page')
      document.body.classList.remove('body--terms-page')
      window.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <>
      <Head>
        <title>Terms &amp; Safety — parlé</title>
        <meta
          name="description"
          content="Read the parlé Terms & Safety Agreement."
        />
      </Head>

      <TermsReadingProgress progress={scrollProgress} />

      <main className="pss-terms-page">
        <header className="pss-terms-page__hero">
          <div className="pss-terms-page__inner">
            <p className="pss-terms-page__eyebrow">Terms &amp; Safety</p>
            <h1 className="pss-terms-page__title">Terms &amp; Safety Agreement</h1>
            <p className="pss-terms-page__subtitle">
              Everything you need to know about using parlé safely, privately, and respectfully.
            </p>
            <p className="pss-terms-page__meta">
              {safetyAgreementSections.length} sections
            </p>
          </div>
        </header>

        <div className="pss-terms-page__document">
          <div className="pss-terms-page__inner">
            <ol className="pss-terms-page__sections">
              {safetyAgreementSections.map((section, index) => (
                <li key={section.id} id={section.id} className="pss-terms-page__section">
                  <div className="pss-terms-page__section-index">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="pss-terms-page__section-content">
                    <h2>{section.title}</h2>
                    <div className="pss-terms-page__prose">
                      {section.body.map((paragraph, paragraphIndex) => (
                        <p key={paragraphIndex}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <footer className="pss-terms-page__site-footer">
          <span className="pss-terms-page__site-mark">parlé</span>
          <span aria-hidden="true">·</span>
          <span>A quiet space, always open.</span>
          <span aria-hidden="true">·</span>
          <Link href="/">Home</Link>
          <span aria-hidden="true">·</span>
          <Link href="/contact">Contact</Link>
        </footer>
      </main>
    </>
  )
}
