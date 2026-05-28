import Link from 'next/link'
import { motion } from 'framer-motion'

export default function FeatureCard({ icon: Icon, title, description, delay = 0, href }) {
  const inner = (
    <>
      <div className="mb-4 w-12 h-12 rounded-full bg-[#a86f52]/10 flex items-center justify-center">
        <Icon className="w-6 h-6 text-[#b8877a]" />
      </div>
      <h3 className="mb-2 text-[#3a2f2f] text-lg font-semibold">{title}</h3>
      <p className="text-[#8a7a7a] leading-relaxed">{description}</p>
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6, delay }}
      className="backdrop-blur-sm bg-white/60 border border-black/5 rounded-2xl p-8 hover:bg-white/80 transition-all duration-300"
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
