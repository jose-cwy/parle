import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeUp, spring } from '../../lib/motion'

/** Custom hero paths — add files to public/images/landing/ when ready */
const HERO_PRIMARY_CUSTOM = '/images/landing/hero-primary.jpg'
const HERO_SECONDARY_CUSTOM = '/images/landing/hero-secondary.jpg'
const FALLBACK_PRIMARY = '/images/ref1.jpg'
const FALLBACK_SECONDARY = '/images/ref2.gif'

function HeroImage({ customSrc, fallback, alt }) {
  const [src, setSrc] = useState(fallback)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const probe = new window.Image()
    probe.onload = () => setSrc(customSrc)
    probe.onerror = () => {}
    probe.src = customSrc
  }, [customSrc])

  function handleError() {
    if (src !== fallback) {
      setSrc(fallback)
      return
    }
    setFailed(true)
  }

  if (failed) {
    return (
      <div className="landing-hero__placeholder">
        Add {customSrc.split('/').pop()} to public/images/landing/
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="landing-hero__img"
      onError={handleError}
      loading="lazy"
      decoding="async"
    />
  )
}

export default function LandingHero({ loggedIn, chatHref }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.section
      className="landing-page__section landing-page__section--hero landing-hero"
      initial={reduceMotion ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={spring.gentle}
      aria-labelledby="landing-hero-title"
    >
      <div className="landing-hero__grain" aria-hidden="true" />
      <div className="landing-hero__grid">
        <div className="landing-hero__copy">
          <div className="landing-page__eyebrow-wrap">
            <p className="landing-page__eyebrow">Private breakup support</p>
            <span className="landing-page__eyebrow-line" aria-hidden="true" />
          </div>
          <h1 id="landing-hero-title" className="landing-page__title">
            A quiet place to let it out.
          </h1>
          <p className="landing-page__lead">
            No feed. No audience. Just you and a steady listener.
          </p>
          <ul className="landing-page__bullets">
            <li>Talk when you are ready</li>
            <li>Write letters and diary</li>
            <li>Quotes when words fail</li>
          </ul>
          <div className="landing-page__actions">
            <Link href={chatHref} className="landing-page__cta-primary">
              Talk it out
            </Link>
            <p className="landing-page__cta-note">
              {loggedIn ? 'Start with one honest sentence.' : 'Free to start. Your words stay private.'}
            </p>
          </div>
        </div>

        <div className="landing-hero__visual">
          <div className="landing-hero__blob" aria-hidden="true" />
          <div className="landing-hero__collage">
            <div className="landing-hero__frame landing-hero__frame--primary">
              <HeroImage
                customSrc={HERO_PRIMARY_CUSTOM}
                fallback={FALLBACK_PRIMARY}
                alt="A quiet moment of reflection"
              />
            </div>
            <div className="landing-hero__frame landing-hero__frame--secondary">
              <HeroImage
                customSrc={HERO_SECONDARY_CUSTOM}
                fallback={FALLBACK_SECONDARY}
                alt="Space to write and heal"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
