import { Children, useEffect, useRef, useState } from 'react'

/**
 * Mobile-only horizontal swipe carousel (max-width 767px).
 * Uses native scroll-snap; dot indicators via IntersectionObserver.
 */
export default function MobileCardCarousel({ children, className = '', trackClassName = '' }) {
  const containerRef = useRef(null)
  const slideRefs = useRef([])
  const [activeIndex, setActiveIndex] = useState(0)
  const childArray = Children.toArray(children)

  useEffect(() => {
    slideRefs.current = slideRefs.current.slice(0, childArray.length)
  }, [childArray.length])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const mq = window.matchMedia('(max-width: 767px)')

    function bindObserver() {
      if (!mq.matches) {
        setActiveIndex(0)
        return undefined
      }

      const slides = slideRefs.current.filter(Boolean)
      if (!slides.length) return undefined

      const observer = new IntersectionObserver(
        (entries) => {
          let best = null
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            if (!best || entry.intersectionRatio > best.intersectionRatio) {
              best = entry
            }
          })
          if (!best) return
          const index = slides.indexOf(best.target)
          if (index >= 0) setActiveIndex(index)
        },
        {
          root: container,
          threshold: [0.35, 0.5, 0.65, 0.85],
        },
      )

      slides.forEach((slide) => observer.observe(slide))
      return () => observer.disconnect()
    }

    let teardown = bindObserver()

    function onMediaChange() {
      if (teardown) teardown()
      teardown = bindObserver()
    }

    mq.addEventListener('change', onMediaChange)
    return () => {
      if (teardown) teardown()
      mq.removeEventListener('change', onMediaChange)
    }
  }, [childArray.length])

  return (
    <div className={`pss-mobile-carousel ${className}`.trim()}>
      <div
        ref={containerRef}
        className={`pss-mobile-carousel__container ${trackClassName}`.trim()}
        role="region"
        aria-roledescription="carousel"
      >
        {childArray.map((child, index) => (
          <div
            key={child?.key ?? `slide-${index}`}
            ref={(el) => {
              slideRefs.current[index] = el
            }}
            className="pss-mobile-carousel__card"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${childArray.length}`}
          >
            {child}
          </div>
        ))}
      </div>
      <div className="pss-mobile-carousel__dots" aria-hidden>
        {childArray.map((child, index) => (
          <span
            key={`dot-${child?.key ?? index}`}
            className={`pss-mobile-carousel__dot${
              index === activeIndex ? ' pss-mobile-carousel__dot--active' : ''
            }`}
          />
        ))}
      </div>
    </div>
  )
}
