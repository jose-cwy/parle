import { AnimatePresence, motion } from 'framer-motion'
import { SkeletonBlock } from './loading'
import { spring } from '../lib/motion'

export default function DeskScene({
  children,
  isSealing,
  onSealAnimationComplete
}){
  return (
    <div className="letter-room-shell">
      <div className="room-scene room-scene-original room-scene--soft">
        <AnimatePresence>
          {isSealing ? (
            <motion.div
              key="sealed-flight"
              className="room-lock-banner room-lock-banner-skeleton"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={spring.modal}
              aria-busy="true"
              aria-label="Sealing letter"
            >
              <SkeletonBlock className="h-3 w-28" rounded="rounded-full" />
              <SkeletonBlock className="mt-2 h-2 w-40" rounded="rounded-full" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="room-paper-stage">
          <motion.div
            className="room-paper-flight"
            animate={
              isSealing
                ? { y: -280, x: 40, rotate: 12, scale: 0.5, opacity: 0 }
                : { y: 0, x: 0, rotate: -1, scale: 1, opacity: 1 }
            }
            transition={isSealing ? { ...spring.gentle, duration: 1.4 } : spring.float}
            onAnimationComplete={() => {
              if(isSealing && onSealAnimationComplete) onSealAnimationComplete()
            }}
          >
            <motion.div
              animate={isSealing ? undefined : { y: [0, -4, 0] }}
              transition={isSealing ? undefined : { duration: 7, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
            >
              {children}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
