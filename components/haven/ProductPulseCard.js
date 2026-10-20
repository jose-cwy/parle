import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { getGuestSessionToken } from '../../lib/parle/guestSessionToken'

const GUEST_SHOWN_DAY_KEY = 'parle_outcome_survey_day'

export function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function wasOutcomeSurveyShownToday() {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(GUEST_SHOWN_DAY_KEY) === utcDayKey()
  } catch {
    return false
  }
}

export function markOutcomeSurveyShownToday() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GUEST_SHOWN_DAY_KEY, utcDayKey())
  } catch {
    /* ignore */
  }
}

async function postProduct(body) {
  try {
    await fetch('/api/feedback/product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
  } catch {
    /* ignore */
  }
}

export default function ProductPulseCard({
  visible,
  sessionId,
  messageCount,
  modeId,
  isGuest,
  onDismiss,
}) {
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState('relief')
  const [submitting, setSubmitting] = useState(false)

  const payload = {
    session_id: sessionId || (isGuest ? getGuestSessionToken() : ''),
    message_count: messageCount,
    mode_id: modeId,
    is_guest: Boolean(isGuest),
  }

  async function finish() {
    onDismiss?.()
  }

  async function submitAnswer(dimension, response) {
    if (submitting) return
    setSubmitting(true)
    await postProduct({ ...payload, action: 'answer', dimension, response })
    setSubmitting(false)
    if (dimension === 'relief') {
      setStep('clarity')
      return
    }
    await finish()
  }

  async function skip(dimension) {
    if (submitting) return
    setSubmitting(true)
    await postProduct({ ...payload, action: 'skip', dimension })
    setSubmitting(false)
    if (dimension === 'relief' || dimension === 'all') {
      await finish()
      return
    }
    await finish()
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="parle-product-pulse"
          initial={reduceMotion ? false : { y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? undefined : { y: '100%', opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-label="Optional check-in"
        >
          {step === 'relief' ? (
            <>
              <p className="parle-product-pulse__question">After talking, do you feel…</p>
              <div className="parle-product-pulse__options">
                {['better', 'same', 'worse'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="parle-product-pulse__option"
                    disabled={submitting}
                    onClick={() => submitAnswer('relief', option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="parle-product-pulse__skip"
                onClick={() => skip('all')}
                disabled={submitting}
              >
                skip
              </button>
            </>
          ) : (
            <>
              <p className="parle-product-pulse__question">
                {modeId === 'vent'
                  ? 'If you wanted to sort things out, is your situation clearer? Skip if you only needed to vent.'
                  : 'Do you understand your situation…'}
              </p>
              <div className="parle-product-pulse__options">
                {[
                  ['clearer', 'clearer'],
                  ['same', 'same'],
                  ['less_clear', 'less clear'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="parle-product-pulse__option"
                    disabled={submitting}
                    onClick={() => submitAnswer('clarity', value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="parle-product-pulse__skip"
                onClick={() => skip('clarity')}
                disabled={submitting}
              >
                skip
              </button>
            </>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export { GUEST_SHOWN_DAY_KEY }
