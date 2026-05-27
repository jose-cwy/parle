import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { hoverLift, spring } from '../../lib/motion'

export default function MenuFeatureCard({ href, icon: Icon, title, description, index = 0, onClick }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="heartstringsMenu__card"
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={reduceMotion ? { duration: 0 } : { ...spring.gentle, delay: 0.08 + index * 0.07, opacity: { duration: 0.35 } }}
    >
      <motion.div {...(reduceMotion ? {} : hoverLift)}>
        <Link href={href} className="heartstringsMenu__cardLink" onClick={onClick}>
          <span className="heartstringsMenu__cardIcon" aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className="heartstringsMenu__cardText">
            <span className="heartstringsMenu__cardTitle">{title}</span>
            <span className="heartstringsMenu__cardDesc">{description}</span>
          </span>
        </Link>
      </motion.div>
    </motion.div>
  )
}

