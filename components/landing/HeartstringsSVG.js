import { useId, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const EASE_IN_OUT = [0.42, 0, 0.58, 1]

const STRINGS = [
  { d: 'M280,120 Q200,100 120,80', origin: '280px 120px', delay: 0 },
  { d: 'M520,120 Q600,100 680,80', origin: '520px 120px', delay: 0.08 },
  { d: 'M300,280 Q220,360 140,440', origin: '300px 280px', delay: 0.16 },
  { d: 'M500,280 Q580,360 660,440', origin: '500px 280px', delay: 0.24 },
]

const OUTER_HEART =
  'M400,150 C400,100 350,80 320,80 C280,80 260,110 260,140 C260,180 300,220 400,300 C500,220 540,180 540,140 C540,110 520,80 480,80 C450,80 400,100 400,150 Z'

const INNER_HEART_LEFT = 'M320,140 Q360,160 380,180 T400,220'
const INNER_HEART_RIGHT = 'M480,140 Q440,160 420,180 T400,220'

/** Barely-visible stroke glow — follows the path, not a circular blob */
const STROKE_GLOW_REST = 'drop-shadow(0 0 1px rgba(184, 135, 122, 0.08))'
const STROKE_GLOW_PULSE = 'drop-shadow(0 0 3px rgba(247, 198, 168, 0.18))'

export default function HeartstringsSVG({ className }) {
  const reduceMotion = useReducedMotion()
  const uid = useId().replace(/:/g, '')

  const t = useMemo(
    () => ({
      stringDraw: 1.2,
      outerDraw: 1.8,
      outerDelay: 0.95,
      innerDraw: 1.15,
      innerDelay: 2.55,
      innerStagger: 0.14,
      drawComplete: 3.85,
      pulseDuration: 3.6,
      pullDuration: 7.5,
    }),
    []
  )

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

  const outerHeartAnimate = reduceMotion
    ? { pathLength: 1, opacity: 0.8, filter: STROKE_GLOW_REST }
    : {
        pathLength: [0, 1],
        opacity: [0, 0.8],
        filter: [STROKE_GLOW_REST, STROKE_GLOW_PULSE, STROKE_GLOW_REST],
        transition: {
          pathLength: { duration: t.outerDraw, delay: t.outerDelay, ease: EASE_IN_OUT },
          opacity: { duration: t.outerDraw, delay: t.outerDelay, ease: EASE_IN_OUT },
          filter: {
            delay: t.drawComplete,
            duration: t.pulseDuration,
            repeat: Infinity,
            ease: EASE_IN_OUT,
            times: [0, 0.5, 1],
          },
        },
      }

  const threadPull = (delayOffset = 0) =>
    reduceMotion
      ? {}
      : {
          rotate: [0, 1.2, -0.9, 0.4, 0],
          x: [0, 1, -0.6, 0.3, 0],
          y: [0, -0.6, 0.5, -0.2, 0],
          transition: {
            delay: t.drawComplete + delayOffset,
            duration: t.pullDuration,
            repeat: Infinity,
            ease: EASE_IN_OUT,
          },
        }

  const heartPulse = reduceMotion
    ? {}
    : {
        scale: [1, 1.012, 1.025, 1.012, 1],
        transition: {
          delay: t.drawComplete,
          duration: t.pulseDuration,
          repeat: Infinity,
          ease: EASE_IN_OUT,
        },
      }

  return (
    <svg
      viewBox="0 0 800 600"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Heartstrings threads"
    >
      <defs>
        <linearGradient id={`${uid}-g1`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b8877a" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#f7c6a8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#e6b8c9" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id={`${uid}-g2`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e6b8c9" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#b8877a" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${uid}-g3`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f7c6a8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#e6b8c9" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`${uid}-g4`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a86f52" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#b89dc7" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Step 1a + 3: diagonal strings — clean strokes, no blob filter */}
      {STRINGS.map((s, i) => (
        <motion.g
          key={s.d}
          style={{ transformOrigin: s.origin, transformBox: 'fill-box' }}
          animate={threadPull(i * 0.15)}
        >
          <motion.path
            d={s.d}
            {...pathCommon}
            stroke={`url(#${uid}-g4)`}
            strokeWidth="2"
            strokeDasharray="5,5"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={drawPath(s.delay, t.stringDraw, 0.7)}
          />
        </motion.g>
      ))}

      {/* Step 1b + 2: heart draws, subtle scale pulse, stroke-only glow on outer path */}
      <motion.g
        style={{ transformOrigin: '400px 220px', transformBox: 'fill-box' }}
        animate={heartPulse}
      >
        <motion.path
          d={OUTER_HEART}
          {...pathCommon}
          stroke={`url(#${uid}-g1)`}
          strokeWidth="2"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={outerHeartAnimate}
        />

        <motion.path
          d={INNER_HEART_LEFT}
          {...pathCommon}
          stroke={`url(#${uid}-g2)`}
          strokeWidth="1.5"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={drawPath(t.innerDelay, t.innerDraw, 0.6)}
        />

        <motion.path
          d={INNER_HEART_RIGHT}
          {...pathCommon}
          stroke={`url(#${uid}-g3)`}
          strokeWidth="1.5"
          initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
          animate={drawPath(t.innerDelay + t.innerStagger, t.innerDraw, 0.6)}
        />
      </motion.g>
    </svg>
  )
}
