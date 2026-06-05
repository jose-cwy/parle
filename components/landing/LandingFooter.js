import Link from 'next/link'
import { motion } from 'framer-motion'

export default function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="py-12 px-6"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}
    >
      <div className="lf-container">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="lf-serif text-2xl italic" style={{ color: 'var(--foreground)' }}>
              parlé
            </div>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              You&apos;re not alone.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
            <Link href="/terms" className="hover:opacity-80 transition-opacity">Terms</Link>
            <Link href="/login" className="hover:opacity-80 transition-opacity">Login</Link>
            <Link href="/chat" className="hover:opacity-80 transition-opacity">Talk</Link>
          </div>

          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            &copy; {year} parlé
          </div>
        </div>
      </div>
    </motion.footer>
  )
}
