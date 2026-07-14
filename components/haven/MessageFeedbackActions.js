import { useEffect, useRef, useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { getGuestSessionToken } from '../../lib/parle/guestSessionToken'

const DOWN_REASONS = ['felt too generic', 'not what i needed', 'missed the point']

async function submitMessageFeedback({
  messageId,
  rating,
  reason,
  modeId,
  isAuthed,
  replyExcerpt,
  userExcerpt,
}) {
  const body = {
    message_id: messageId,
    rating,
    reason: reason || undefined,
    mode_id: modeId || undefined,
    reply_excerpt: replyExcerpt || undefined,
    user_excerpt: userExcerpt || undefined,
    is_guest: !isAuthed,
    session_id: !isAuthed ? getGuestSessionToken() : undefined,
  }

  try {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
  } catch {
    /* ignore network errors */
  }
}

export default function MessageFeedbackActions({
  messageId,
  modeId,
  isAuthed,
  disabled,
  replyExcerpt,
  userExcerpt,
}) {
  const [rating, setRating] = useState(null)
  const [showReasons, setShowReasons] = useState(false)
  const [pillsFading, setPillsFading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!showReasons) return undefined

    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        dismissReasons(null)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReasons, submitted, messageId, modeId, isAuthed, replyExcerpt, userExcerpt])

  function fadePillsAway() {
    setPillsFading(true)
    window.setTimeout(() => {
      setShowReasons(false)
      setPillsFading(false)
    }, 180)
  }

  async function dismissReasons(reason) {
    if (submitted) {
      fadePillsAway()
      return
    }
    setSubmitted(true)
    setRating('down')
    fadePillsAway()
    await submitMessageFeedback({
      messageId,
      rating: 'down',
      reason,
      modeId,
      isAuthed,
      replyExcerpt,
      userExcerpt,
    })
  }

  async function handleThumbsUp() {
    if (disabled || rating || showReasons) return
    setRating('up')
    setSubmitted(true)
    await submitMessageFeedback({
      messageId,
      rating: 'up',
      modeId,
      isAuthed,
      replyExcerpt,
      userExcerpt,
    })
  }

  function handleThumbsDown() {
    if (disabled || rating === 'up' || submitted) return
    setRating('down')
    setShowReasons(true)
    setPillsFading(false)
  }

  if (!messageId) return null

  return (
    <div ref={rootRef} className="parle-msg-feedback">
      {showReasons ? (
        <div
          className={cn(
            'parle-msg-feedback__reasons',
            pillsFading && 'parle-msg-feedback__reasons--fade',
          )}
          role="group"
          aria-label="Why was this unhelpful"
        >
          {DOWN_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              className="parle-msg-feedback__pill"
              onClick={() => dismissReasons(reason)}
            >
              {reason}
            </button>
          ))}
        </div>
      ) : (
        <div className="parle-msg-feedback__actions">
          <button
            type="button"
            className={cn(
              'parle-msg-feedback__btn',
              rating === 'up' && 'parle-msg-feedback__btn--selected',
            )}
            onClick={handleThumbsUp}
            disabled={disabled || Boolean(rating)}
            aria-label="Thumbs up"
            title="Helpful"
          >
            <ThumbsUp
              size={14}
              strokeWidth={1.75}
              fill={rating === 'up' ? 'currentColor' : 'none'}
            />
          </button>
          <button
            type="button"
            className={cn(
              'parle-msg-feedback__btn',
              rating === 'down' && 'parle-msg-feedback__btn--selected',
            )}
            onClick={handleThumbsDown}
            disabled={disabled || rating === 'up' || submitted}
            aria-label="Thumbs down"
            title="Not helpful"
          >
            <ThumbsDown
              size={14}
              strokeWidth={1.75}
              fill={rating === 'down' ? 'currentColor' : 'none'}
            />
          </button>
        </div>
      )}
    </div>
  )
}
