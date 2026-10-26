import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { spring } from '../../lib/motion'

export default function VerifyNotice({ email = '' }) {
  const reduceMotion = useReducedMotion()
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function sendConfirmation() {
    if (loading) return
    setLoading(true)
    setStatus('')
    try {
      const res = await fetch('/api/auth/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }),
      })
      if (res.ok) setStatus('sent')
      else if (res.status === 429) setStatus('wait')
      else setStatus('failed')
    } catch {
      setStatus('failed')
    }
    setLoading(false)
  }

  const statusText = {
    wait: 'Please wait a minute before requesting another email.',
    failed: 'We could not send that just now. Try again in a little while.',
    sent: 'If this mailbox can receive mail, a confirmation link is on its way.',
  }[status]

  return (
    <motion.aside
      className="parle-verify-notice"
      role="status"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : spring.gentle}
    >
      <div className="parle-verify-notice__copy">
        <p className="parle-verify-notice__title">Confirm this email is yours</p>
        <p className="parle-verify-notice__body">
          Your space stays open for now. Confirming the mailbox keeps it protected if someone else ever tries to use it.
        </p>
        {statusText ? <p className="parle-verify-notice__feedback">{statusText}</p> : null}
      </div>
      <div className="parle-verify-notice__actions">
        <button
          type="button"
          className="parle-verify-notice__send"
          onClick={sendConfirmation}
          disabled={loading}
        >
          {loading ? 'Sending…' : 'Send confirmation'}
        </button>
        <a className="parle-verify-notice__recovery" href="/verify-email/recovery">
          I can’t use this email
        </a>
      </div>
    </motion.aside>
  )
}
