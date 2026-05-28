import { motion, useReducedMotion } from 'framer-motion'

export default function AuthPageShell({ children }) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="auth-page">
      <div className="auth-page__bg" aria-hidden="true">
        <div className="auth-page__bgGradient" />
        <div className="auth-page__bgGlow auth-page__bgGlow--one" />
        <div className="auth-page__bgGlow auth-page__bgGlow--two" />
      </div>

      <motion.div
        className="auth-page__inner"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </div>
  )
}
