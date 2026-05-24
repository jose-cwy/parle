import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SkeletonBlock } from './Skeleton'
import { spring, hoverGlow } from '../lib/motion'

/**
 * Interactive paper editor.
 * This component only owns the writing surface and button interactions.
 * The surrounding room illustration lives in DeskScene so the DOM stays simpler.
 */
export default function LetterEditor({
  value,
  onChange,
  onSave,
  onComplete,
  loading,
  isCompleted,
  isSealing,
  updatedAt
}){
  const textareaRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if(!textareaRef.current) return

    // Auto-resize the paper so it grows with the letter without layout jumps.
    textareaRef.current.style.height = '0px'
    textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, isFocused ? 410 : 360)}px`
  }, [value, isFocused])

  const letterLength = value.trim().length
  const pulseKey = Math.max(0, Math.floor(letterLength / 24))

  return (
    <motion.div
      className={`room-letter-sheet ${isCompleted ? 'room-letter-sheet-sealed' : ''} ${isFocused ? 'room-letter-sheet-active' : ''}`}
      animate={isSealing ? { scaleY: [1, 0.84, 0.58], rotateX: [0, 18, 38] } : { scaleY: 1, rotateX: 0 }}
      transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
    >
      {!isCompleted ? (
        <>
          <div className="room-letter-topline">
            <div>
              <p className="room-letter-label">Letter to Yourself</p>
              <p className="room-letter-meta">{updatedAt ? `Last saved ${new Date(updatedAt).toLocaleString()}` : 'Write slowly. This room is here for you.'}</p>
            </div>
            <div className="room-letter-meta-wrap">
              <motion.div
                key={pulseKey}
                className="room-typing-orb"
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: [0.88, 1.15, 1], opacity: [0.5, 1, 0.7] }}
                transition={{ duration: 0.45 }}
              />
              <div className="room-letter-pin" />
            </div>
          </div>

          <div className="room-letter-body">
            <motion.div
              className="room-letter-focus-glow"
              animate={{
                opacity: isFocused ? 1 : 0.55,
                scale: isFocused ? 1.02 : 1
              }}
              transition={{ duration: 0.24 }}
            />

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Write a letter to yourself..."
              className="letter-textarea room-letter-input"
              disabled={loading || isCompleted || isSealing}
            />

            <div className="room-letter-lines" />
          </div>

          <div className="room-letter-footer">
            <p className="room-letter-hint">
              {letterLength ? `${letterLength} characters of honesty` : 'Start with one gentle sentence.'}
            </p>

            <div className="room-action-strip">
              {loading ? (
                <>
                  <SkeletonBlock className="h-11 w-32" rounded="rounded-full" />
                  <SkeletonBlock className="h-11 w-36" rounded="rounded-full" />
                </>
              ) : (
                <>
              <motion.button
                type="button"
                onClick={onSave}
                disabled={isCompleted || isSealing}
                className="room-action-chip room-action-chip-primary"
                {...hoverGlow}
              >
                Save Draft
              </motion.button>

              <motion.button
                type="button"
                onClick={onComplete}
                disabled={isCompleted || isSealing}
                className="room-action-chip"
                {...hoverGlow}
              >
                Complete Letter
              </motion.button>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="room-letter-complete">
          <div className="room-envelope">
            <span className="room-envelope-flap" />
            <span className="room-envelope-seal" />
          </div>
          <p className="mt-4 text-sm leading-7 subtle">
            Your letter is sealed now. The words are tucked away until a future feature decides when it can be reopened.
          </p>
        </div>
      )}
    </motion.div>
  )
}
