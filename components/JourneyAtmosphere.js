import { motion, useTransform, useReducedMotion } from 'framer-motion'
import { STARS_PHASE_END } from './MoonStoryScene'

/**
 * Scroll-driven vignette + warmth overlay for the full heartbreak → healing arc.
 */
export default function JourneyAtmosphere({ scrollProgress }) {
  const reduceMotion = useReducedMotion()

  const vignetteOpacity = useTransform(
    scrollProgress,
    [0, 0.10, 0.16, 0.22, STARS_PHASE_END, 0.55, 0.78, 0.87, 1],
    reduceMotion
      ? [0.2, 0.2, 0.35, 0.3, 0.22, 0.15, 0.1, 0.08, 0.06]
      : [0.08, 0.22, 0.52, 0.45, 0.3, 0.2, 0.12, 0.08, 0.05]
  )

  const warmthOpacity = useTransform(
    scrollProgress,
    [0, 0.22, STARS_PHASE_END, 0.55, 0.78, 1],
    reduceMotion
      ? [0, 0, 0.12, 0.18, 0.22, 0.25]
      : [0, 0, 0.08, 0.2, 0.32, 0.4]
  )

  return (
    <div className="journey-atmosphere" aria-hidden="true">
      <motion.div
        className="journey-atmosphere__vignette"
        style={{ opacity: vignetteOpacity }}
      />
      <motion.div
        className="journey-atmosphere__warmth"
        style={{ opacity: warmthOpacity }}
      />
    </div>
  )
}
