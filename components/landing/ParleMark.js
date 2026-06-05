import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const EASE_IN_OUT = [0.42, 0, 0.58, 1]

const STRINGS = [
  {
    d: 'M280,120 Q200,100 120,80',
    delay: 0,
    heart: { x: 280, y: 120 },
    pin: { x: 120, y: 80 },
  },
  {
    d: 'M520,120 Q600,100 680,80',
    delay: 0.08,
    heart: { x: 520, y: 120 },
    pin: { x: 680, y: 80 },
  },
  {
    /* Anchored on left lower heart curve (260,140 → 400,300) */
    d: 'M328,242 Q210,340 140,440',
    delay: 0.16,
    heart: { x: 328, y: 242 },
    pin: { x: 140, y: 440 },
  },
  {
    /* Anchored on right lower heart curve (400,300 → 540,140) */
    d: 'M472,242 Q590,340 660,440',
    delay: 0.24,
    heart: { x: 472, y: 242 },
    pin: { x: 660, y: 440 },
  },
]

const OUTER_HEART =
  'M400,150 C400,100 350,80 320,80 C280,80 260,110 260,140 C260,180 300,220 400,300 C500,220 540,180 540,140 C540,110 520,80 480,80 C450,80 400,100 400,150 Z'

const INNER_HEART_LEFT = 'M320,140 Q360,160 380,180 T400,220'
const INNER_HEART_RIGHT = 'M480,140 Q440,160 420,180 T400,220'

const STRING_DRAW = 1.2
const OUTER_DRAW = 1.8
const OUTER_DELAY = 0.95
const INNER_DRAW = 1.15
const INNER_DELAY = 2.55
const INNER_STAGGER = 0.14

function AnchorPin({ x, y, delay, reduceMotion, uid, variant = 'pin' }) {
  const fade = reduceMotion
    ? { opacity: variant === 'knot' ? 0.88 : 0.82 }
    : {
        opacity: [0, variant === 'knot' ? 0.9 : 0.82],
        transition: { duration: 0.45, delay: delay + 0.35, ease: EASE_IN_OUT },
      }

  const ringR = variant === 'knot' ? 5.5 : 4.5
  const coreR = variant === 'knot' ? 3.2 : 2.4

  return (
    <motion.g initial={reduceMotion ? false : { opacity: 0 }} animate={fade}>
      <circle
        cx={x}
        cy={y}
        r={ringR}
        fill="none"
        stroke={`url(#${uid}-anchor-ring)`}
        strokeWidth="1"
        opacity="0.55"
      />
      <circle cx={x} cy={y} r={coreR} fill={`url(#${uid}-anchor-core)`} />
      {variant === 'knot' ? (
        <circle
          cx={x}
          cy={y}
          r="1.15"
          fill="rgba(255, 235, 232, 0.5)"
          stroke="rgba(166, 63, 58, 0.35)"
          strokeWidth="0.5"
        />
      ) : null}
    </motion.g>
  )
}

export default function ParleMark({ className = '' }) {
  const reduceMotion = useReducedMotion()
  const uid = useId().replace(/:/g, '')

  const pathCommon = {
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  const drawPath = (delay, duration, opacity) =>
    reduceMotion
      ? { pathLength: 1, opacity }
      : {
          pathLength: [0, 1],
          opacity: [0, opacity],
          transition: { duration, delay, ease: EASE_IN_OUT },
        }

  const drawInitial = reduceMotion ? false : { pathLength: 0, opacity: 0 }

  const strokeFilter = `url(#${uid}-stroke-glow)`

  return (
    <svg
      viewBox="0 0 800 600"
      className={`parle-mark ${className}`.trim()}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="parlé mark"
    >
      <defs>
        <linearGradient id={`${uid}-heart-outer`} x1="32%" y1="18%" x2="68%" y2="88%">
          <stop offset="0%" stopColor="#8f3a34" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#c54b44" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#a63f3a" stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id={`${uid}-heart-inner`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a63f3a" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#d46962" stopOpacity="0.82" />
        </linearGradient>

        <linearGradient id={`${uid}-string`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8f3a34" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#c54b44" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a63f3a" stopOpacity="0.82" />
        </linearGradient>

        <linearGradient id={`${uid}-string-fiber`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8f3a34" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#c54b44" stopOpacity="0.35" />
        </linearGradient>

        <radialGradient id={`${uid}-anchor-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e8a39c" />
          <stop offset="100%" stopColor="#a63f3a" />
        </radialGradient>

        <linearGradient id={`${uid}-anchor-ring`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c54b44" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#8f3a34" stopOpacity="0.7" />
        </linearGradient>

        <filter
          id={`${uid}-stroke-glow`}
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.9" floodColor="#8f3a34" floodOpacity="0.16" />
          <feDropShadow dx="0" dy="0" stdDeviation="1.4" floodColor="#c54b44" floodOpacity="0.12" />
        </filter>
      </defs>

      <g filter={strokeFilter}>
        {STRINGS.map((s) => (
          <g key={s.d}>
            <motion.path
              d={s.d}
              {...pathCommon}
              stroke={`url(#${uid}-string-fiber)`}
              strokeWidth="2.6"
              strokeDasharray="1 0"
              opacity="0.22"
              initial={drawInitial}
              animate={drawPath(s.delay, STRING_DRAW, 0.22)}
            />
            <motion.path
              d={s.d}
              {...pathCommon}
              stroke={`url(#${uid}-string)`}
              strokeWidth="1.65"
              strokeDasharray="3.5 5.5"
              initial={drawInitial}
              animate={drawPath(s.delay, STRING_DRAW, 0.82)}
            />
          </g>
        ))}

        <motion.path
          d={OUTER_HEART}
          {...pathCommon}
          stroke={`url(#${uid}-heart-outer)`}
          strokeWidth="2.1"
          initial={drawInitial}
          animate={drawPath(OUTER_DELAY, OUTER_DRAW, 0.9)}
        />

        <motion.path
          d={INNER_HEART_LEFT}
          {...pathCommon}
          stroke={`url(#${uid}-heart-inner)`}
          strokeWidth="1.45"
          initial={drawInitial}
          animate={drawPath(INNER_DELAY, INNER_DRAW, 0.72)}
        />

        <motion.path
          d={INNER_HEART_RIGHT}
          {...pathCommon}
          stroke={`url(#${uid}-heart-inner)`}
          strokeWidth="1.45"
          initial={drawInitial}
          animate={drawPath(INNER_DELAY + INNER_STAGGER, INNER_DRAW, 0.72)}
        />
      </g>

      <g>
        {STRINGS.map((s) => (
          <g key={`anchor-${s.d}`}>
            <AnchorPin
              x={s.heart.x}
              y={s.heart.y}
              delay={s.delay}
              reduceMotion={reduceMotion}
              uid={uid}
              variant="knot"
            />
            <AnchorPin
              x={s.pin.x}
              y={s.pin.y}
              delay={s.delay}
              reduceMotion={reduceMotion}
              uid={uid}
              variant="pin"
            />
          </g>
        ))}
      </g>
    </svg>
  )
}
