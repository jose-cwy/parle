import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { spreadFloat } from '../../lib/landingMotion'
import { landingAssets } from '../../lib/landingAssets'

const HOTSPOTS = [
  {
    id: 'chat',
    label: 'Chat — talk when ready',
    href: '/chat',
    top: '28%',
    left: '62%',
    chip: 'Chat',
  },
  {
    id: 'letter',
    label: 'Letter — write to your future self',
    href: '/letter-to-yourself',
    top: '68%',
    left: '22%',
    chip: 'Letter',
  },
  {
    id: 'diary',
    label: 'Diary — private pages',
    href: '/diary',
    top: '52%',
    left: '48%',
    chip: 'Diary',
  },
  {
    id: 'quotes',
    label: 'Quotes — words when yours go quiet',
    href: '/quotes',
    top: '18%',
    left: '28%',
    chip: 'Quotes',
  },
]

export default function DiarySpreadHero({
  loggedIn,
  activeChip,
  onChipFocus,
  depthLayer = null,
  imageY = 0,
}) {
  const reduceMotion = useReducedMotion()
  const [activeId, setActiveId] = useState(activeChip || 'chat')

  useEffect(() => {
    if (activeChip) setActiveId(activeChip)
  }, [activeChip])

  const resolveHref = useCallback(
    (path) => (loggedIn ? path : `/login?next=${path}`),
    [loggedIn]
  )

  function handleFocus(id, chip) {
    setActiveId(id)
    onChipFocus?.(chip)
  }

  return (
    <motion.div className="diary-spread" style={{ y: imageY }}>
      <div className="diary-spread__frame">
        <Image
          src={landingAssets.heroDeskJournal}
          alt=""
          fill
          sizes="(max-width: 900px) 100vw, 50vw"
          className="diary-spread__img"
          priority
          aria-hidden="true"
        />
        {depthLayer}
        <div className="diary-spread__vignette" aria-hidden="true" />
        <div className="diary-spread__lamp" aria-hidden="true" />

        <div className="diary-spread__hotspots">
          {HOTSPOTS.map((spot) => {
            const isActive = activeId === spot.id
            return (
              <motion.div
                key={spot.id}
                className="diary-spread__hotspot-wrap"
                style={{ top: spot.top, left: spot.left }}
                {...(reduceMotion ? {} : spreadFloat)}
              >
                <Link
                  href={resolveHref(spot.href)}
                  className={`diary-spread__hotspot${isActive ? ' diary-spread__hotspot--active' : ''}`}
                  aria-label={spot.label}
                  onMouseEnter={() => handleFocus(spot.id, spot.chip)}
                  onFocus={() => handleFocus(spot.id, spot.chip)}
                >
                  <span className="diary-spread__hotspot-ring" aria-hidden="true" />
                  <span className="diary-spread__hotspot-core" aria-hidden="true" />
                </Link>
                {isActive && (
                  <motion.span
                    className="diary-spread__hotspot-tag"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {spot.chip}
                  </motion.span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
