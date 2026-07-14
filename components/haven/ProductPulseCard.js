import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { getGuestSessionToken } from '../../lib/parle/guestSessionToken'

const PULSE_SHOWN_KEY = 'parle_product_pulse_shown'
const PULSE_VARIANT_KEY = 'parle_product_pulse_variant'

const VARIANTS = {
  A: {
    question: 'is parlé helping right now?',
    options: ['helping', 'a little', 'not really'],
    negative: 'not really',
  },
  B: {
    question: "would you come back next time you're stuck?",
    options: ['yes', 'maybe', 'probably not'],
    negative: 'probably not',
  },
}

function pickVariant() {
  return Math.random() < 0.5 ? 'A' : 'B'
}

export function wasProductPulseShown() {
  if (typeof window === 'undefined') return true
  try {
    return sessionStorage.getItem(PULSE_SHOWN_KEY) === '1'
  } catch {
    return false
  }
}

export function markProductPulseShown(variant) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(PULSE_SHOWN_KEY, '1')
    if (variant) sessionStorage.setItem(PULSE_VARIANT_KEY, variant)
  } catch {
    /* ignore */
  }
}

function getStoredVariant() {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(PULSE_VARIANT_KEY)
  } catch {
    return null
  }
}

export default function ProductPulseCard({
  visible,
  sessionId,
  messageCount,
  isGuest,
  onDismiss,
}) {
  const reduceMotion = useReducedMotion()
  const [variant] = useState(() => getStoredVariant() || pickVariant())
  const config = useMemo(() => VARIANTS[variant] || VARIANTS.A, [variant])
  const [submitting, setSubmitting] = useState(false)
  const [response, setResponse] = useState(null)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)

  useEffect(() => {
    if (visible) markProductPulseShown(variant)
  }, [visible, variant])

  async function save({ responseValue, noteValue }) {
    try {
      await fetch('/api/feedback/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          session_id: sessionId || (isGuest ? getGuestSessionToken() : 'unknown'),
          variant,
          response: responseValue,
          note: noteValue || undefined,
          message_count: messageCount,
          is_guest: Boolean(isGuest),
        }),
      })
    } catch {
      /* ignore */
    }
  }

  async function handleOption(option) {
    if (submitting) return
    setResponse(option)

    if (option === config.negative) {
      setShowNote(true)
      return
    }

    setSubmitting(true)
    await save({ responseValue: option })
    setSubmitting(false)
    onDismiss?.()
  }

  async function sendNote() {
    if (submitting || !response) return
    setSubmitting(true)
    await save({ responseValue: response, noteValue: note })
    setSubmitting(false)
    onDismiss?.()
  }

  async function skipNote() {
    if (submitting || !response) return
    setSubmitting(true)
    await save({ responseValue: response })
    setSubmitting(false)
    onDismiss?.()
  }

  function skip() {
    onDismiss?.()
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
          aria-label="Quick feedback"
        >
          <p className="parle-product-pulse__question">{config.question}</p>
          {!showNote ? (
            <>
              <div className="parle-product-pulse__options">
                {config.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="parle-product-pulse__option"
                    disabled={submitting}
                    onClick={() => handleOption(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="parle-product-pulse__skip"
                onClick={skip}
                disabled={submitting}
              >
                skip
              </button>
            </>
          ) : (
            <div className="parle-product-pulse__followup">
              <textarea
                className="parle-product-pulse__textarea"
                rows={2}
                placeholder="what would help more? (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="parle-product-pulse__followup-actions">
                <button type="button" className="parle-product-pulse__link" onClick={sendNote}>
                  send
                </button>
                <button type="button" className="parle-product-pulse__link" onClick={skipNote}>
                  skip
                </button>
              </div>
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export { PULSE_SHOWN_KEY }
