import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function LetterEditor({
  value,
  onChange,
  onSave,
  onComplete,
  loading,
  isCompleted,
  isSealing,
  updatedAt,
  onSealAnimationComplete
}){
  const textareaRef = useRef(null)

  useEffect(() => {
    if(!textareaRef.current) return
    textareaRef.current.style.height = '0px'
    textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 360)}px`
  }, [value])

  return (
    <div className="letter-room-shell">
      <div className="room-scene">
        <div className="room-wall" />
        <div className="room-window">
          <div className="room-window-sky" />
          <div className="room-window-frame room-window-frame-x" />
          <div className="room-window-frame room-window-frame-y" />
          <div className="room-window-cloud room-window-cloud-one" />
          <div className="room-window-cloud room-window-cloud-two" />
        </div>

        <div className="room-garland">
          {[0, 1, 2, 3, 4].map((light) => (
            <span key={light} className="room-garland-light" style={{ animationDelay: `${light * 0.15}s` }} />
          ))}
        </div>

        <motion.div className="room-teddy" animate={{ y: [0, -5, 0] }} transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}>
          <span className="room-teddy-ear room-teddy-ear-left" />
          <span className="room-teddy-ear room-teddy-ear-right" />
          <span className="room-teddy-head" />
          <span className="room-teddy-body" />
        </motion.div>

        <motion.div className="room-guitar" animate={{ rotate: [-3, -1, -3] }} transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}>
          <span className="room-guitar-neck" />
          <span className="room-guitar-head" />
          <span className="room-guitar-body" />
          <span className="room-guitar-hole" />
        </motion.div>

        <div className="room-floor" />
        <div className="room-desk-shadow" />
        <div className="room-desk">
          <div className="room-desk-edge" />
        </div>

        <AnimatePresence>
          {isSealing ? (
            <motion.div
              key="sealed-flight"
              className="room-lock-banner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              It has been locked
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="room-paper-stage">
          <motion.div
            className="room-paper-flight"
            animate={isSealing ? { y: -320, x: 40, rotate: 12, scale: 0.52, opacity: 0 } : { y: 0, x: 0, rotate: -1.5, scale: 1, opacity: 1 }}
            transition={{ duration: 1.35, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => {
              if(isSealing && onSealAnimationComplete) onSealAnimationComplete()
            }}
          >
            <motion.div
              className={`room-letter-sheet ${isCompleted ? 'room-letter-sheet-sealed' : ''}`}
              animate={isSealing ? { scaleY: [1, 0.86, 0.62], rotateX: [0, 14, 32] } : { scaleY: 1, rotateX: 0 }}
              transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
            >
              {!isCompleted ? (
                <>
                  <div className="room-letter-topline">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">My room letter</p>
                      <p className="mt-1 text-sm subtle">{updatedAt ? `Last saved ${new Date(updatedAt).toLocaleString()}` : 'Begin whenever you are ready'}</p>
                    </div>
                    <div className="room-letter-pin" />
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Dear me..."
                    className="letter-textarea room-letter-input"
                    disabled={loading || isCompleted || isSealing}
                  />
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
          </motion.div>
        </div>

        <div className="room-action-strip">
          <button
            type="button"
            onClick={onSave}
            disabled={loading || isCompleted || isSealing}
            className="room-action-chip room-action-chip-primary"
          >
            {loading ? 'Saving...' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={onComplete}
            disabled={loading || isCompleted || isSealing}
            className="room-action-chip"
          >
            Finish letter
          </button>
        </div>
      </div>
    </div>
  )
}
