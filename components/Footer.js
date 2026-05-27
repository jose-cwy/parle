import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { isLandingThemeRoute } from '../lib/routes'

export default function Footer() {
  const router = useRouter()
  const landingTheme = isLandingThemeRoute(router.pathname)

  if (router.pathname === '/') return null

  return (
    <motion.footer
      className="w-full py-10 mt-12"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`container footer-shell text-center subtle sketch-frame${landingTheme ? ' footer-shell--landing' : ''}`}
      >
        <p className="eyebrow" style={landingTheme ? undefined : undefined}>
          Still here when you need it
        </p>
        <p className="mt-3">&copy; {new Date().getFullYear()} Heartstrings Club</p>
        <p className="mt-2 text-sm max-w-md mx-auto">
          A warm digital sanctuary for reflection, support, and healing. Like a room you can return to after dark.
        </p>
      </div>
    </motion.footer>
  )
}
