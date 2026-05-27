import { motion } from 'framer-motion'

export default function FeatureCard({ icon: Icon, title, description, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6, delay }}
      className="backdrop-blur-sm bg-white/60 border border-black/5 rounded-2xl p-8 hover:bg-white/80 transition-all duration-300"
    >
      <div className="mb-4 w-12 h-12 rounded-full bg-[#d4818f]/10 flex items-center justify-center">
        <Icon className="w-6 h-6 text-[#d4818f]" />
      </div>
      <h3 className="mb-2 text-[#3a2f2f] text-lg font-semibold">{title}</h3>
      <p className="text-[#8a7a7a] leading-relaxed">{description}</p>
    </motion.div>
  )
}

