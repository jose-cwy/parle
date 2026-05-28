import '../styles/tokens.css'
import '../styles/globals.css'
import '../styles/loading.css'
import '../styles/app-theme.css'
import { useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Head from 'next/head'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/600.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/router'
import { pageTransition } from '../lib/motion'
import { isAppRoute, isFullBleedRoute, isLandingThemeRoute } from '../lib/routes'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const fullBleed = isFullBleedRoute(router.pathname)
  const appLayout = isAppRoute(router.pathname)
  const landingTheme = isLandingThemeRoute(router.pathname)
  const isHome = router.pathname === '/'
  const isAuthPage = router.pathname === '/login' || router.pathname === '/register'

  useEffect(() => {
    if (landingTheme) {
      document.body.classList.add('body--landing')
    } else {
      document.body.classList.remove('body--landing', 'body--nav-open')
    }
    if (appLayout) {
      document.body.classList.add('body--app')
    } else {
      document.body.classList.remove('body--app')
    }
    return () => {
      document.body.classList.remove('body--landing', 'body--nav-open', 'body--app')
    }
  }, [landingTheme, appLayout])

  return (
    <div
      className={`min-h-screen flex flex-col app-shell${landingTheme ? ' app-shell--landing-theme' : ''}`}
      style={isHome ? { scrollBehavior: 'smooth' } : undefined}
    >
      <Head>
        <title>Heartstrings Club | Teen Heartbreak Support Website</title>
        <meta name="description" content="Heartstrings Club is a teen heartbreak support website with private diary, emotional support chatbot, and healing quotes." />
        <meta name="keywords" content="teen heartbreak support website, breakup support for teens, healing quotes, private diary" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {!fullBleed && !appLayout && !isHome && !isAuthPage && (
        <>
          <div className="page-noise" />
          <div className="page-glow page-glow-one" />
          <div className="page-glow page-glow-two" />
          <div className="page-glow page-glow-three" />
        </>
      )}

      {!appLayout && (
        <div className={fullBleed ? 'absolute top-0 left-0 right-0 z-40' : 'relative z-30'}>
          <Header />
        </div>
      )}

      {fullBleed ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={router.asPath}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1"
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      ) : appLayout ? (
        <main className="flex-1 relative z-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={router.asPath} {...pageTransition} className="h-full min-h-[calc(100vh-0px)]">
              <Component {...pageProps} />
            </motion.div>
          </AnimatePresence>
        </main>
      ) : isAuthPage ? (
        <main className="flex-1 relative z-10 auth-page-main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={router.asPath} {...pageTransition}>
              <Component {...pageProps} />
            </motion.div>
          </AnimatePresence>
        </main>
      ) : (
        <main className="flex-1 container py-8 relative z-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={router.asPath} {...pageTransition}>
              <Component {...pageProps} />
            </motion.div>
          </AnimatePresence>
        </main>
      )}

      {!fullBleed && !appLayout && !isAuthPage && <Footer />}
    </div>
  )
}
