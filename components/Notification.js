import { AnimatePresence, motion } from 'framer-motion'

/**
 * Lightweight toast used for small confirmations like draft saves.
 * Keeping it separate from the blocking modal makes interactions feel faster.
 */
export default function Notification({ open, message }){
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed right-4 top-24 z-50"
          initial={{ opacity: 0, y: -14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="room-toast">
            <span className="room-toast-dot" />
            <span>{message}</span>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
