import { motion, useTransform, useReducedMotion } from 'framer-motion'

const LINES = [
  ['A', 'private'],
  ['sanctuary'],
  ['for', 'heartbreak'],
]

function Word({ word, offset, scrollProgress, phaseEnd, reduceMotion }) {
  const x = useTransform(
    scrollProgress,
    [0, phaseEnd * 0.5, phaseEnd],
    reduceMotion ? [0, 0, 0] : [offset * 14, offset * 6, 0]
  )
  const y = useTransform(
    scrollProgress,
    [0, phaseEnd * 0.55, phaseEnd],
    reduceMotion ? [0, 0, 0] : [6, 3, 0]
  )

  return (
    <motion.span className="cinematic-headline__word" style={{ x, y }}>
      {word}
    </motion.span>
  )
}

/**
 * Scroll-split typographic hero lines (phase 0 only).
 */
export default function CinematicHeadline({ scrollProgress, phaseEnd = 0.09 }) {
  const reduceMotion = useReducedMotion()

  const opacity = useTransform(
    scrollProgress,
    [0, phaseEnd * 0.35, phaseEnd * 0.85, phaseEnd],
    reduceMotion ? [1, 1, 1, 0] : [1, 1, 0.85, 0]
  )

  const containerY = useTransform(
    scrollProgress,
    [0, phaseEnd],
    reduceMotion ? [0, 0] : [0, -18]
  )

  return (
    <motion.div
      className="cinematic-headline"
      style={{ opacity, y: containerY }}
      aria-hidden="true"
    >
      {LINES.map((words, lineIdx) => (
        <div key={lineIdx} className="cinematic-headline__line">
          {words.map((word, wordIdx) => {
            const offset = wordIdx - (words.length - 1) / 2
            return (
              <Word
                key={`${lineIdx}-${word}`}
                word={word}
                offset={offset}
                scrollProgress={scrollProgress}
                phaseEnd={phaseEnd}
                reduceMotion={reduceMotion}
              />
            )
          })}
        </div>
      ))}
    </motion.div>
  )
}
