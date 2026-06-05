import { motion } from 'framer-motion'

export default function AnimatedHamburger({ isOpen, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lf-hamburger"
      aria-label="Menu"
      aria-expanded={isOpen}
    >
      <motion.span
        animate={{ rotate: isOpen ? 45 : 0, y: isOpen ? 8 : 0 }}
        transition={{ duration: 0.3 }}
        className="lf-hamburger__line"
      />
      <motion.span
        animate={{ opacity: isOpen ? 0 : 1, x: isOpen ? -10 : 0 }}
        transition={{ duration: 0.2 }}
        className="lf-hamburger__line"
      />
      <motion.span
        animate={{ rotate: isOpen ? -45 : 0, y: isOpen ? -8 : 0 }}
        transition={{ duration: 0.3 }}
        className="lf-hamburger__line"
      />
    </button>
  )
}
