import { motion } from 'framer-motion'

export default function Footer(){
  return (
    <motion.footer
      className="w-full py-10 mt-12"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="container footer-shell text-center subtle">
        <p>&copy; {new Date().getFullYear()} Heartstrings Club</p>
        <p className="mt-2 text-sm">A softer digital space for reflection, support, and healing.</p>
      </div>
    </motion.footer>
  )
}
