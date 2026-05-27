import { motion } from 'framer-motion'
import OceanNightBg from './OceanNightBg'

export default function DiaryRoomHero(){
  return (
    <div className="diary-room-hero">
      <OceanNightBg />
      <motion.div
        className="diary-room-shade"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <div className="diary-room-content">
        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow">Your writing nook</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-3xl">A quiet room for today&apos;s pages</h2>
          <p className="mt-2 max-w-md text-sm subtle">
            Put the day somewhere safe. If the breakup keeps looping, write one honest page and leave it here.
          </p>
        </motion.div>
        <motion.div
          className="diary-room-float-icons"
          aria-hidden="true"
          animate={{ y: [0, -6, 0] }}
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
      <svg className="diary-room-sketch-overlay" viewBox="0 0 800 600" aria-hidden="true">
        <g opacity="0.7">
          <rect x="320" y="360" width="72" height="52" rx="4" fill="rgba(2,10,24,0.8)" stroke="rgba(45,212,191,0.4)" strokeWidth="1.5" transform="rotate(-4 356 386)" />
          <line x1="356" y1="372" x2="356" y2="404" stroke="rgba(45,212,191,0.25)" strokeWidth="1.2" transform="rotate(-4 356 386)" />
          <path d="M332,382 L348,382 M332,392 L346,392 M364,382 L378,382" stroke="rgba(45,212,191,0.2)" strokeWidth="1" transform="rotate(-4 356 386)" />
          <ellipse cx="420" cy="340" rx="18" ry="22" fill="rgba(2,10,24,0.7)" stroke="rgba(45,212,191,0.35)" strokeWidth="1.5" />
          <rect x="412" y="358" width="16" height="8" rx="2" fill="rgba(45,212,191,0.25)" />
          <motion.ellipse
            cx="420"
            cy="340"
            rx="28"
            ry="32"
            fill="rgba(45,212,191,0.08)"
            animate={{ opacity: [0.3, 0.65, 0.35] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
          />
        </g>
      </svg>
    </div>
  )
}
