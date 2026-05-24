import { useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'

/**
 * JourneySection — a scroll-driven chapter wrapper.
 * Each section fades in as it enters the viewport and gently fades out
 * as it leaves. Children receive scrollYProgress via a render prop if needed.
 */
export default function JourneySection({
  id,
  children,
  className = '',
  fadeOut = false,   // whether to fade out as it leaves (true for non-final chapters)
  offset = ['start end', 'end start'],
}) {
  const ref = useRef(null)
  const shouldReduceMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: ref,
    offset,
  })

  const opacity = useTransform(
    scrollYProgress,
    fadeOut ? [0, 0.15, 0.75, 1] : [0, 0.15, 1, 1],
    shouldReduceMotion ? [1, 1, 1, 1] : (fadeOut ? [0, 1, 1, 0] : [0, 1, 1, 1])
  )

  const y = useTransform(
    scrollYProgress,
    [0, 0.2],
    shouldReduceMotion ? [0, 0] : [32, 0]
  )

  return (
    <motion.section
      ref={ref}
      id={id}
      className={`journey-section ${className}`}
      style={{ opacity, y }}
    >
      {typeof children === 'function'
        ? children({ scrollYProgress })
        : children}
    </motion.section>
  )
}
