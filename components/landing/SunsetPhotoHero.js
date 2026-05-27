import { motion, useMotionValueEvent, useReducedMotion, useTransform } from 'framer-motion'
import { landingAssets } from '../../lib/landingAssets'

export default function SunsetPhotoHero({ scrollYProgress, onScrollProgress }) {
  const reduceMotion = useReducedMotion()
  const progress = useTransform(scrollYProgress, [0, 1], [0, 1])

  useMotionValueEvent(progress, 'change', (v) => {
    onScrollProgress?.(v)
  })

  // Keep the photo static; only animate the sun for a parallax/3D feel.
  const sunY = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, 240])
  const sunX = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, 18])
  const sunOpacity = useTransform(progress, [0, 0.55, 0.92], reduceMotion ? [1, 1, 1] : [1, 0.95, 0])
  const sunScale = useTransform(progress, [0, 1], reduceMotion ? [1, 1] : [1, 0.9])
  const sunRotateX = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, 10])
  const sunRotateY = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, -12])

  return (
    <div
      className="landing-heroSunset__bg landing-heroSunset__bg--photo"
      style={{
        '--sunset-photo-url': `url(${landingAssets.sunsetPoster})`,
        '--sun-clean-url': `url(/images/landing/sun-isolated-clean.png)`,
      }}
      aria-hidden="true"
    >
      <div className="landing-heroSunset__poster">
        <img className="landing-heroSunset__posterImg" src={landingAssets.sunsetPoster} alt="" loading="eager" decoding="async" />
      </div>

      <>
        {/* Hide the built-in sun by stamping nearby sky texture from the same artwork. */}
        <div className="landing-heroSunset__sunStamp" />

        <motion.div
          className="landing-heroSunset__sun"
          style={{
            x: sunX,
            y: sunY,
            opacity: sunOpacity,
            scale: sunScale,
            rotateX: sunRotateX,
            rotateY: sunRotateY,
            transformPerspective: 900,
          }}
        >
          <img className="landing-heroSunset__sunImg" src="/images/landing/sun-isolated-clean.png" alt="" decoding="async" />
        </motion.div>

        <div className="landing-heroSunset__oceanForeground" />
      </>
    </div>
  )
}
