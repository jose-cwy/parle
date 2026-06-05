import { useEffect, useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { safetyAgreementSections } from '../data/safetyAgreementContent'

export default function TermsPage() {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    function updateScrollState() {
      const doc = document.documentElement
      const maxScroll = doc.scrollHeight - window.innerHeight
      setScrollProgress(maxScroll <= 0 ? 1 : Math.min(1, window.scrollY / maxScroll))
    }

    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      window.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
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

      <main className="pss-terms-page">
        <div
          className="pss-terms-page__progress-rail"
          role="progressbar"
          aria-valuenow={Math.round(scrollProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        >
          <div
            className="pss-terms-page__progress-bar"
            style={{ width: `${Math.round(scrollProgress * 100)}%` }}
          />
        </div>

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
