import { AnimatePresence, motion } from 'framer-motion'
import CozyRoomIllustration from './CozyRoomIllustration'
import { SkeletonBlock } from './Skeleton'
import { spring } from '../lib/motion'

export default function DeskScene({
  children,
  isSealing,
  onSealAnimationComplete
}){
  return (
    <div className="letter-room-shell">
      <div className="room-scene room-scene-original">
        <CozyRoomIllustration showOverlay={false} className="absolute inset-0" />

        <AnimatePresence>
          {isSealing ? (
            <motion.div
              key="sealed-flight"
              className="room-lock-banner room-lock-banner-skeleton"
              initial={{ opacity: 0, y: 24, scale: 0.94, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -16, scale: 0.98, filter: 'blur(4px)' }}
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
                ? { y: -380, x: 80, rotate: 18, scale: 0.45, opacity: 0, filter: 'blur(6px)' }
                : { y: 0, x: 0, rotate: -2, scale: 1, opacity: 1, filter: 'blur(0px)' }
            }
            transition={isSealing ? { ...spring.gentle, duration: 1.6 } : spring.float}
            onAnimationComplete={() => {
              if(isSealing && onSealAnimationComplete) onSealAnimationComplete()
            }}
          >
            <motion.div
              animate={isSealing ? undefined : { y: [0, -5, 0] }}
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
