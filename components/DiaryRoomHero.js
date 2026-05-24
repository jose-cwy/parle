import { motion } from 'framer-motion'
import CozyRoomIllustration from './CozyRoomIllustration'

/**
 * Diary page hero — original cozy nook with journal-focused details overlaid.
 */
export default function DiaryRoomHero(){
  return (
    <div className="diary-room-hero">
      <CozyRoomIllustration compact showOverlay={false} className="diary-room-art" />
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
            Open your journal by lamplight. Each entry stays private, warm, and yours.
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
        <g opacity="0.9">
          <rect x="320" y="360" width="72" height="52" rx="4" fill="#FFF4E8" stroke="#3D2A22" strokeWidth="2" transform="rotate(-4 356 386)" />
          <line x1="356" y1="372" x2="356" y2="404" stroke="#D4C4A8" strokeWidth="1.5" transform="rotate(-4 356 386)" />
          <path d="M332,382 L348,382 M332,392 L346,392 M364,382 L378,382" stroke="#C4A888" strokeWidth="1.2" transform="rotate(-4 356 386)" />
          <ellipse cx="420" cy="340" rx="18" ry="22" fill="#FFE8C0" stroke="#3D2A22" strokeWidth="1.8" />
          <rect x="412" y="358" width="16" height="8" rx="2" fill="#8B5A48" />
          <motion.ellipse
            cx="420"
            cy="340"
            rx="28"
            ry="32"
            fill="rgba(255,200,120,0.2)"
            animate={{ opacity: [0.35, 0.65, 0.4] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
          />
        </g>
      </svg>
    </div>
  )
}
