import Link from 'next/link'
import { motion } from 'framer-motion'

export default function FeatureCard({ icon: Icon, title, description, delay = 0, href }) {
  const inner = (
    <>
      <div className="landing-v2-feature-card__icon">
        <Icon className="w-6 h-6" strokeWidth={1.6} />
      </div>
      <h3 className="landing-v2-feature-card__title">{title}</h3>
      <p className="landing-v2-feature-card__desc">{description}</p>
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6, delay }}
      className="landing-v2-feature-card"
    >
      {href ? (
        <Link
          href={href}
          className="block rounded-2xl -m-2 p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a86f52]/40 focus-visible:ring-offset-2"
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </motion.div>
  )
}
