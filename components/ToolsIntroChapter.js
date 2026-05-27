import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'

const ICONS = {
  chat: '💬',
  letter: '✉️',
  diary: '📔',
  quotes: '✦',
}

const EXPO = [0.16, 1, 0.3, 1]

/**
 * Four tools intro — before feature trail (phase 4).
 */
export default function ToolsIntroChapter({ features, visible }) {
  const reduceMotion = useReducedMotion()

  if (!visible) return null

  return (
    <motion.div
      className="tools-intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.55, ease: EXPO }}
    >
      <p className="tools-intro__eyebrow">Four ways to let it out</p>
      <h2 className="tools-intro__title">Everything here is private. Everything is yours.</h2>
      <ul className="tools-intro__grid">
        {features.map((feat, i) => (
          <motion.li
            key={feat.id}
            className="tools-intro__item"
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, duration: 0.55, ease: EXPO }}
          >
            <span className="tools-intro__icon" aria-hidden="true">
              {ICONS[feat.id] || '·'}
            </span>
            <span className="tools-intro__label">{feat.title.split('.')[0]}</span>
            <p className="tools-intro__line">{feat.heartbreakLine}</p>
            <Link href={feat.href} className="tools-intro__link">
              {feat.link}
            </Link>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}
