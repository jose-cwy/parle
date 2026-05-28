import { motion } from 'framer-motion'

export default function DiaryRoomHero(){
  return (
    <div className="diary-room-hero">
      <div className="diary-room-content">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="app-date-chip">Your journal</span>
          <p className="eyebrow">Your writing nook</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl section-title">A quiet room for today&apos;s pages</h2>
          <p className="mt-2 max-w-md text-sm subtle">
            Put the day somewhere safe. If the breakup keeps looping, write one honest page and leave it here.
          </p>
        </motion.div>
        <motion.div
          className="diary-room-float-icons"
          aria-hidden="true"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
        >
          <svg className="diary-room-deco diary-room-deco-a" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M5 4h12v16H5z" />
            <path d="M9 8h6M9 12h5" />
          </svg>
          <svg className="diary-room-deco diary-room-deco-b" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 20 L20 4" strokeLinecap="round" />
            <path d="M15 4h5v5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </div>
    </div>
  )
}
