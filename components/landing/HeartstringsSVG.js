import { motion } from 'framer-motion'

export default function HeartstringsSVG({ className }) {
  return (
    <svg
      viewBox="0 0 800 600"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Heartstrings threads"
    >
      <defs>
        <filter id="heartstrings-glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id="heartstrings-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4818f" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#f7c6a8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#e6b8c9" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="heartstrings-gradient-2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e6b8c9" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#d4818f" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="heartstrings-gradient-3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f7c6a8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#e6b8c9" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="heartstrings-gradient-4" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4818f" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#b89dc7" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      <motion.path
        d="M400,150 C400,100 350,80 320,80 C280,80 260,110 260,140 C260,180 300,220 400,300 C500,220 540,180 540,140 C540,110 520,80 480,80 C450,80 400,100 400,150 Z"
        fill="none"
        stroke="url(#heartstrings-gradient-1)"
        strokeWidth="2"
        filter="url(#heartstrings-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.8 }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />

      <motion.path
        d="M320,140 Q360,160 380,180 T400,220"
        fill="none"
        stroke="url(#heartstrings-gradient-2)"
        strokeWidth="1.5"
        filter="url(#heartstrings-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.6 }}
        transition={{ duration: 2.5, delay: 0.3, ease: 'easeInOut' }}
      />

      <motion.path
        d="M480,140 Q440,160 420,180 T400,220"
        fill="none"
        stroke="url(#heartstrings-gradient-3)"
        strokeWidth="1.5"
        filter="url(#heartstrings-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.6 }}
        transition={{ duration: 2.5, delay: 0.5, ease: 'easeInOut' }}
      />

      <motion.path
        d="M280,120 Q200,100 120,80"
        fill="none"
        stroke="url(#heartstrings-gradient-4)"
        strokeWidth="2"
        strokeDasharray="5,5"
        filter="url(#heartstrings-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 1.5, delay: 2, ease: 'easeOut' }}
      />

      <motion.path
        d="M520,120 Q600,100 680,80"
        fill="none"
        stroke="url(#heartstrings-gradient-4)"
        strokeWidth="2"
        strokeDasharray="5,5"
        filter="url(#heartstrings-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 1.5, delay: 2.2, ease: 'easeOut' }}
      />

      <motion.path
        d="M300,280 Q220,360 140,440"
        fill="none"
        stroke="url(#heartstrings-gradient-4)"
        strokeWidth="2"
        strokeDasharray="5,5"
        filter="url(#heartstrings-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 1.5, delay: 2.4, ease: 'easeOut' }}
      />

      <motion.path
        d="M500,280 Q580,360 660,440"
        fill="none"
        stroke="url(#heartstrings-gradient-4)"
        strokeWidth="2"
        strokeDasharray="5,5"
        filter="url(#heartstrings-glow)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.7 }}
        transition={{ duration: 1.5, delay: 2.6, ease: 'easeOut' }}
      />
    </svg>
  )
}

