import { useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { Check, Copy, Mail, MessageCircle } from 'lucide-react'

export const SUPPORT_EMAIL = 'support.parle@gmail.com'

const FEEDBACK_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('parlé feedback')}`

const topics = [
  {
    title: 'Share feedback',
    description: 'Tell us what is working, what feels off, or what you wish parlé did differently.',
  },
  {
    title: 'Report a problem',
    description: 'Something broken, confusing, or not behaving the way you expected? Let us know.',
  },
  {
    title: 'Ask a question',
    description: 'Privacy, accounts, or how something works — we are happy to help.',
  },
]

export default function ContactPage() {
  const [copied, setCopied] = useState(false)

  async function handleCopyEmail() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.location.href = FEEDBACK_MAILTO
    }
  }

  return (
    <>
      <Head>
        <title>Contact — parlé</title>
        <meta
          name="description"
          content="Send feedback, report an issue, or ask a question about parlé."
        />
      </Head>

      <main className="pss-contact-page">
        <div className="pss-contact-page__wrap">
          <article className="pss-contact-page__card">
            <header className="pss-contact-page__header">
              <p className="pss-contact-page__eyebrow">Contact</p>
              <h1 className="pss-contact-page__title">We would love to hear from you</h1>
              <p className="pss-contact-page__subtitle">
                Feedback helps parlé stay thoughtful, safe, and useful. Send us a note anytime.
              </p>
            </header>

            <div className="pss-contact-page__body">
              <div className="pss-contact-page__email-block">
                <span className="pss-contact-page__email-icon" aria-hidden="true">
                  <Mail size={20} strokeWidth={1.75} />
                </span>
                <div className="pss-contact-page__email-copy">
                  <p className="pss-contact-page__email-label">Email us at</p>
                  <a href={FEEDBACK_MAILTO} className="pss-contact-page__email">
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </div>

              <div className="pss-contact-page__actions">
                <a href={FEEDBACK_MAILTO} className="pss-contact-page__btn pss-contact-page__btn--primary">
                  <MessageCircle size={18} strokeWidth={1.75} aria-hidden="true" />
                  Send feedback
                </a>
                <button
                  type="button"
                  className="pss-contact-page__btn pss-contact-page__btn--secondary"
                  onClick={handleCopyEmail}
                >
                  {copied ? (
                    <>
                      <Check size={18} strokeWidth={1.75} aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={18} strokeWidth={1.75} aria-hidden="true" />
                      Copy email
                    </>
                  )}
                </button>
              </div>

              <ul className="pss-contact-page__topics">
                {topics.map((topic) => (
                  <li key={topic.title} className="pss-contact-page__topic">
                    <h2>{topic.title}</h2>
                    <p>{topic.description}</p>
                  </li>
                ))}
              </ul>

              <p className="pss-contact-page__note">
                parlé is not an emergency service. If you are in crisis, please contact local emergency
                services or a crisis line in your area.
              </p>
            </div>

            <footer className="pss-contact-page__footer">
              <Link href="/">Back to home</Link>
              <span aria-hidden="true">·</span>
              <Link href="/terms">Terms &amp; Safety</Link>
            </footer>
          </article>
        </div>

        <footer className="pss-contact-page__site-footer">
          <span className="pss-contact-page__site-mark">parlé</span>
          <span aria-hidden="true">·</span>
          <span>A quiet space, always open.</span>
        </footer>
      </main>
    </>
  )
}
