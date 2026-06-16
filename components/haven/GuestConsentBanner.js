import Link from 'next/link'
import { useEffect, useState } from 'react'

const CONSENT_KEY = 'parle_guest_consent'

export function isGuestConsentAccepted() {
  if (typeof window === 'undefined') return true
  try {
    return sessionStorage.getItem(CONSENT_KEY) === 'accepted'
  } catch {
    return true
  }
}

export function acceptGuestConsent() {
  try {
    sessionStorage.setItem(CONSENT_KEY, 'accepted')
  } catch {
    /* ignore */
  }
}

export default function GuestConsentBanner({ visible }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!visible) {
      setShow(false)
      return
    }
    setShow(!isGuestConsentAccepted())
  }, [visible])

  if (!show) return null

  function handleAccept() {
    acceptGuestConsent()
    setShow(false)
  }

  return (
    <div className="parle-guest-consent" role="region" aria-label="Terms and data use notice">
      <div className="parle-guest-consent__inner">
        <p className="parle-guest-consent__text">
          By using parlé, you agree to our Terms. Anonymised chats may be used to improve our AI.
          We never sell your data.
        </p>
        <div className="parle-guest-consent__actions">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="parle-guest-consent__link"
          >
            View Terms
          </Link>
          <button type="button" className="parle-guest-consent__btn" onClick={handleAccept}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
