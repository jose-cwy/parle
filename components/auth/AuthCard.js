import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import HeartLogo from '../landing/HeartLogo'

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.18 },
  },
}

const item = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.42, 0, 0.58, 1] },
  },
}

export default function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  privacyNote = 'Your thoughts stay private. No feed. Just you.',
  dimmed = false,
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.article
      className={`auth-page__card${dimmed ? ' auth-page__card--dimmed' : ''}`}
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="auth-page__paperEdge" aria-hidden="true" />

      <svg className="auth-page__threadDetail" viewBox="0 0 320 24" aria-hidden="true">
        <path
          d="M8 14 C 80 6, 240 6, 312 14"
          fill="none"
          stroke="rgba(184, 135, 122, 0.35)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="160" cy="10" r="2.5" fill="rgba(184, 135, 122, 0.4)" />
      </svg>

      <div className="auth-page__logoWrap">
        <HeartLogo size={32} />
      </div>

      <p className="auth-page__eyebrow">{eyebrow}</p>
      <h1 className="auth-page__title">{title}</h1>
      <p className="auth-page__description">{description}</p>

      <motion.div
        className="auth-page__formWrap"
        variants={reduceMotion ? undefined : stagger}
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
      >
        {children}
      </motion.div>

      {footer && (
        <motion.p className="auth-page__footer" variants={reduceMotion ? undefined : item}>
          {footer}
        </motion.p>
      )}

      {privacyNote && (
        <p className="auth-page__privacy">{privacyNote}</p>
      )}
    </motion.article>
  )
}

export function AuthField({ label, children }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.label className="auth-page__field" variants={reduceMotion ? undefined : item}>
      <span className="auth-page__label">{label}</span>
      {children}
    </motion.label>
  )
}

export function AuthSubmitButton({ children, loading, disabled, type = 'submit' }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div variants={reduceMotion ? undefined : item}>
      <motion.button
        type={type}
        className="auth-page__submit"
        disabled={disabled || loading}
        whileHover={reduceMotion || disabled || loading ? undefined : { scale: 1.02, y: -1 }}
        whileTap={reduceMotion || disabled || loading ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        {loading ? 'Please wait…' : children}
      </motion.button>
    </motion.div>
  )
}

export function AuthSwitchLink({ href, children }) {
  return (
    <Link href={href} className="auth-page__switchLink">
      {children}
    </Link>
  )
}
