import { useState } from 'react'
import { isValidGuestEmail } from '../../lib/parle/guestEmail'

export default function GuestEmailPrompt({
  confirmed = false,
  submitting = false,
  onSubmit,
  onSkip,
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const value = email.trim()
    if (!isValidGuestEmail(value)) {
      setError('enter a valid email')
      return
    }
    setError('')
    onSubmit?.(value)
  }

  if (confirmed) {
    return (
      <div className="parle-guest-email-prompt parle-guest-email-prompt--confirmed" role="status">
        <div className="parle-guest-email-prompt__divider" aria-hidden />
        <p className="parle-guest-email-prompt__confirmation">
          got it. we&apos;ll check in gently. 💙
        </p>
      </div>
    )
  }

  return (
    <div className="parle-guest-email-prompt" role="region" aria-label="Optional email check-in">
      <div className="parle-guest-email-prompt__divider" aria-hidden />
      <p className="parle-guest-email-prompt__label">want a quiet check-in from parlé?</p>
      <form className="parle-guest-email-prompt__form" onSubmit={handleSubmit}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          className="parle-guest-email-prompt__input"
          placeholder="your email — nothing else"
          value={email}
          disabled={submitting}
          onChange={(event) => {
            setEmail(event.target.value)
            if (error) setError('')
          }}
        />
        <button
          type="submit"
          className="parle-guest-email-prompt__submit"
          disabled={submitting || !email.trim()}
          aria-label="Send email"
        >
          →
        </button>
      </form>
      {error ? (
        <p className="parle-guest-email-prompt__error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="parle-guest-email-prompt__skip"
        onClick={onSkip}
        disabled={submitting}
      >
        skip
      </button>
    </div>
  )
}
