import { motion, useReducedMotion } from 'framer-motion'
import { inkDraw } from '../../lib/motion'

export default function HeartLogo({ className, size = 18 }) {
  const reduceMotion = useReducedMotion()

  return (
    <span className={`heartLogo ${className || ''}`} aria-hidden="true" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="heartLogoStroke" x1="8" y1="10" x2="56" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#b8877a" />
            <stop offset="0.55" stopColor="#c4a090" />
            <stop offset="1" stopColor="#9a8b82" />
          </linearGradient>
          <filter id="heartLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.path
          d="M32 52.5C21.8 44 12.5 35.8 12.5 25.8C12.5 19.1 17.6 14.5 23.9 14.5C27.9 14.5 30.9 16.6 32 19.2C33.1 16.6 36.1 14.5 40.1 14.5C46.4 14.5 51.5 19.1 51.5 25.8C51.5 35.8 42.2 44 32 52.5Z"
          stroke="url(#heartLogoStroke)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={reduceMotion ? undefined : 'url(#heartLogoGlow)'}
          initial={reduceMotion ? false : 'hidden'}
          animate={reduceMotion ? undefined : 'visible'}
          variants={inkDraw}
          custom={0.05}
        />

        <g opacity="0.55">
          {[
            { x: 20, y: 22, r: -18 },
            { x: 26, y: 18, r: -8 },
            { x: 38, y: 18, r: 8 },
            { x: 44, y: 22, r: 18 },
            { x: 18, y: 30, r: -26 },
            { x: 46, y: 30, r: 26 },
          ].map((s, i) => (
            <path
              key={i}
              d={`M${s.x - 2} ${s.y} L${s.x + 2} ${s.y}`}
              stroke="rgba(184,135,122,0.45)"
              strokeWidth="1.4"
              strokeLinecap="round"
              transform={`rotate(${s.r} ${s.x} ${s.y})`}
            />
          ))}
        </g>

        {!reduceMotion && (
          <motion.circle
            cx="32"
            cy="30"
            r="18"
            fill="rgba(184,135,122,0.08)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
          />
        )}
      </svg>
    </span>
  )
}
