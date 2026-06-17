import { useEffect, useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import { useReducedMotion } from 'framer-motion'
import { Check, Copy, Mail, MessageCircle } from 'lucide-react'
import { getFeedbackComposeUrl, openFeedbackCompose, SUPPORT_EMAIL } from '../lib/contact'
import ParleLogo from '../components/brand/ParleLogo'

const FEEDBACK_COMPOSE_URL = getFeedbackComposeUrl()

function typingDelay(char, nextChar) {
  if (char === '@' || char === '.' || nextChar === '@') return 140
  if (char === ' ') return 90
  return 42 + Math.random() * 48
}

function TypingEmail({ email, composeUrl }) {
  const reduceMotion = useReducedMotion()
  const [displayed, setDisplayed] = useState(reduceMotion ? email : '')

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(email)
      return undefined
    }

    let index = 0
    let timeoutId

    function typeNext() {
      index += 1
      setDisplayed(email.slice(0, index))

      if (index < email.length) {
        timeoutId = window.setTimeout(typeNext, typingDelay(email[index - 1], email[index]))
      }
    }

    timeoutId = window.setTimeout(typeNext, 500)
    return () => window.clearTimeout(timeoutId)
  }, [email, reduceMotion])

  return (
    <a
      href={composeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="pss-contact-page__email"
      aria-label={`Email ${email}`}
    >
      <span className="pss-contact-page__email-typed" aria-hidden="true">
        {displayed}
        <span className="pss-contact-page__cursor" />
      </span>
    </a>
  )
}

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
      openFeedbackCompose()
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
        <header className="pss-contact-page__hero">
          <div className="pss-contact-page__inner">
            <p className="pss-contact-page__eyebrow">Contact</p>
            <h1 className="pss-contact-page__title">We would love to hear from you</h1>
            <p className="pss-contact-page__subtitle">
              Feedback helps parlé stay thoughtful, safe, and useful. Send us a note anytime.
            </p>

            <div className="pss-contact-page__email-row">
              <div className="pss-contact-page__email-block">
                <span className="pss-contact-page__email-icon" aria-hidden="true">
                  <Mail size={22} strokeWidth={1.75} />
                </span>
                <div className="pss-contact-page__email-copy">
                  <p className="pss-contact-page__email-label">Email us at</p>
                  <TypingEmail email={SUPPORT_EMAIL} composeUrl={FEEDBACK_COMPOSE_URL} />
                </div>
              </div>

              <div className="pss-contact-page__actions">
                <a
                  href={FEEDBACK_COMPOSE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pss-contact-page__btn pss-contact-page__btn--primary"
                >
                  <MessageCircle size={15} strokeWidth={1.75} aria-hidden="true" />
                  Send feedback
                </a>
                <button
                  type="button"
                  className="pss-contact-page__btn pss-contact-page__btn--secondary"
                  onClick={handleCopyEmail}
                >
                  {copied ? (
                    <>
                      <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={15} strokeWidth={1.75} aria-hidden="true" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="pss-contact-page__content" aria-label="How we can help">
          <div className="pss-contact-page__inner">
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
        </section>

        <footer className="pss-contact-page__site-footer">
          <span className="pss-contact-page__site-mark">
            <ParleLogo variant="inline" size="md" />
          </span>
          <span aria-hidden="true">·</span>
          <span>A quiet space, always open.</span>
          <span aria-hidden="true">·</span>
          <Link href="/">Home</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms">Terms &amp; Safety</Link>
        </footer>
      </main>
    </>
  )
}
