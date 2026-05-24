import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

/**
 * Original abstract warm composition — golden-hour sanctuary mood
 * without reproducing reference room illustrations.
 */
const floatingPapers = [
  { id: 'a', className: 'sanctuary-paper sanctuary-paper-a', delay: 0 },
  { id: 'b', className: 'sanctuary-paper sanctuary-paper-b', delay: 0.7 },
  { id: 'c', className: 'sanctuary-paper sanctuary-paper-c', delay: 1.3 },
]

const lanternGlows = [
  { id: 'a', className: 'sanctuary-lantern sanctuary-lantern-a', duration: 4.4 },
  { id: 'b', className: 'sanctuary-lantern sanctuary-lantern-b', duration: 5.2 },
  { id: 'c', className: 'sanctuary-lantern sanctuary-lantern-c', duration: 3.9 },
]

export default function SanctuaryAtmosphere({ compact = false, className = '' }){
  return (
    <div className={`sanctuary ${compact ? 'sanctuary-compact' : ''} ${className}`} aria-hidden="true">
      <div className="sanctuary-base" />

      <motion.div
        className="sanctuary-beams"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...spring.breath, delay: 0.12 }}
      />

      <motion.div
        className="sanctuary-wash"
        animate={{ opacity: [0.35, 0.62, 0.4], scale: [1, 1.04, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
      />

      <motion.div
        className="sanctuary-blob sanctuary-blob-warm"
        animate={{ y: [0, -14, 0], x: [0, 8, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
      />
      <motion.div
        className="sanctuary-blob sanctuary-blob-amber"
        animate={{ y: [0, 12, 0], x: [0, -10, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: [0.45, 0, 0.2, 1], delay: 0.8 }}
      />
      <motion.div
        className="sanctuary-blob sanctuary-blob-olive"
        animate={{ y: [0, -9, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: [0.45, 0, 0.2, 1], delay: 0.4 }}
      />

      <div className="sanctuary-masonry">
        {['a', 'b', 'c', 'd'].map((tile, index) => (
          <motion.span
            key={tile}
            className={`sanctuary-tile sanctuary-tile-${tile}`}
            animate={{ y: [0, -3 - index, 0], opacity: [0.55, 0.85, 0.6] }}
            transition={{ duration: 6 + index * 0.5, repeat: Infinity, ease: [0.45, 0, 0.2, 1], delay: index * 0.3 }}
          />
        ))}
      </div>

      {floatingPapers.map((paper, index) => (
        <motion.div
          key={paper.id}
          className={paper.className}
          animate={{ y: [0, -5 - index, 0], rotate: [0, index % 2 ? -1.4 : 1.6, 0] }}
          transition={{ duration: 5.8 + index * 0.6, repeat: Infinity, ease: [0.45, 0, 0.2, 1], delay: paper.delay }}
        />
      ))}

      {lanternGlows.map((lantern) => (
        <motion.span
          key={lantern.id}
          className={lantern.className}
          animate={{ opacity: [0.4, 0.88, 0.48], scale: [0.92, 1.1, 0.96] }}
          transition={{ duration: lantern.duration, repeat: Infinity, ease: [0.45, 0, 0.2, 1] }}
        />
      ))}

      <svg className="sanctuary-sketch" viewBox="0 0 400 300" preserveAspectRatio="none">
        <path d="M16,248 Q92,218 168,242 T312,228" fill="none" stroke="rgba(255,179,71,0.14)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M288,52 Q336,88 372,136" fill="none" stroke="rgba(107,123,76,0.16)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M44,72 Q88,96 68,148" fill="none" stroke="rgba(255,249,240,0.09)" strokeWidth="1" strokeLinecap="round" />
        <path d="M220,180 Q260,160 300,188" fill="none" stroke="rgba(192,64,0,0.1)" strokeWidth="1.3" strokeLinecap="round" />
      </svg>

      <div className="sanctuary-grain" />
      <div className="sanctuary-vignette" />
    </div>
  )
}
