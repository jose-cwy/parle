import '../styles/tokens.css'
import '../styles/theme-palette.css'
import '../styles/parle-brand.css'
import '../styles/globals.css'
import '../styles/typography.css'
import '../styles/loading.css'
import '../styles/app-theme.css'
import '../styles/haven.css'
import '../styles/parle-chat.css'
import '../styles/quotes-book.css'
import '../styles/marketing.css'
import '../styles/parler-landing.css'
import '../styles/dark-mode.css'
import '../styles/responsive.css'
import '../styles/mobile-app.css'
import { useEffect } from 'react'
import TopProgressProvider from '../components/TopProgressProvider'
import { ThemeProvider } from '../components/ThemeProvider'
import AppShell from '../components/AppShell'
import RequireAuth from '../components/RequireAuth'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Head from 'next/head'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/router'
import { marketingPageTransition, pageTransition } from '../lib/motion'
import { rememberChatReturnPath } from '../lib/parle/chatNavigation'
import {
  isAppRoute,
  isChatRoute,
  isFullBleedRoute,
  isLandingThemeRoute,
  isMarketingCreamRoute,
  isParlerMarketingPage,
  isProtectedAppRoute,
} from '../lib/routes'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const fullBleed = isFullBleedRoute(router.pathname)
  const appLayout = isAppRoute(router.pathname)
  const landingTheme = isLandingThemeRoute(router.pathname)
  const marketingCream = isMarketingCreamRoute(router.pathname)
  const isHome = router.pathname === '/'
  const isAuthPage = router.pathname === '/login' || router.pathname === '/register' || router.pathname === '/welcome'
  const isParlerMarketing = isParlerMarketingPage(router.pathname)
  const isParlerShell = isHome || isAuthPage || isParlerMarketing

  useEffect(() => {
    if (landingTheme) {
      document.body.classList.add('body--landing')
    } else {
      document.body.classList.remove('body--landing', 'body--nav-open')
    }
    if (marketingCream) {
      document.body.classList.add('body--marketing')
    } else {
      document.body.classList.remove('body--marketing')
    }
    if (isParlerShell) {
      document.body.classList.add('body--home-hero', 'body--parler-landing')
    } else {
      document.body.classList.remove('body--home-hero', 'body--parler-landing')
    }
    if (appLayout) {
      document.body.classList.add('body--app')
    } else {
      document.body.classList.remove('body--app')
    }
    if (isAuthPage) {
      document.body.classList.add('body--auth')
    } else {
      document.body.classList.remove('body--auth')
    }
    return () => {
      document.body.classList.remove(
        'body--landing',
        'body--nav-open',
        'body--marketing',
        'body--home-hero',
        'body--parler-landing',
        'body--app',
        'body--auth',
      )
    }
  }, [landingTheme, marketingCream, appLayout, isParlerShell, isAuthPage])

  useEffect(() => {
    function onRouteChangeStart(url) {
      const next = url.split('?')[0].split('#')[0]
      const current = router.asPath.split('?')[0].split('#')[0]
      if (
        (next === '/chat' || next.startsWith('/chat/')) &&
        current !== '/chat' &&
        !current.startsWith('/chat/')
      ) {
        rememberChatReturnPath(current)
      }
    }

    router.events.on('routeChangeStart', onRouteChangeStart)
    return () => router.events.off('routeChangeStart', onRouteChangeStart)
  }, [router])

  useEffect(() => {
    ;['/', '/login', '/register', '/chat', '/dashboard', '/journal', '/quotes'].forEach(
      (path) => router.prefetch(path),
    )
  }, [router])

  useEffect(() => {
    if (!appLayout) return undefined

    function scrollAppToTop() {
      window.scrollTo(0, 0)
    }

    router.events.on('routeChangeComplete', scrollAppToTop)
    return () => router.events.off('routeChangeComplete', scrollAppToTop)
  }, [router.events, appLayout])

  return (
    <ThemeProvider>
    <TopProgressProvider>
    <div
      className={`min-h-screen flex flex-col app-shell${landingTheme ? ' app-shell--landing-theme' : ''}`}
      style={isHome ? { scrollBehavior: 'smooth' } : undefined}
    >
      <Head>
        <title>parlé — A private space for heartbreak</title>
        <meta name="description" content="A private digital space for young people to share thoughts, feelings, and heartbreak stories safely and anonymously." />
        <meta name="keywords" content="heartbreak support, private journal, AI companion, safe space, teen support" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        <link rel="alternate icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="application-name" content="parlé" />
        <meta name="theme-color" content="#231821" />
        <meta name="msapplication-TileColor" content="#231821" />
      </Head>

      {!fullBleed && !appLayout && !isHome && !isAuthPage && !isParlerMarketing && (
        <>
          <div className="page-noise" />
          <div className="page-glow page-glow-one" />
          <div className="page-glow page-glow-two" />
          <div className="page-glow page-glow-three" />
        </>
      )}

      {!appLayout && !isHome && <Header />}

      {fullBleed ? (
        <div className="flex-1">
          <Component {...pageProps} />
        </div>
      ) : appLayout ? (
        <AppShell hideRail={isChatRoute(router.pathname)}>
          <RequireAuth enabled={isProtectedAppRoute(router.pathname)}>
            <Component {...pageProps} key={router.asPath} />
          </RequireAuth>
        </AppShell>
      ) : isAuthPage ? (
        <main className="flex-1 relative z-10 auth-page-main">
          <AnimatePresence mode="sync" initial={false}>
            <motion.div key={router.asPath} {...marketingPageTransition}>
              <Component {...pageProps} />
            </motion.div>
          </AnimatePresence>
        </main>
      ) : isParlerMarketing ? (
        <div className="flex-1 relative z-10">
          <AnimatePresence mode="sync" initial={false}>
            <motion.div key={router.asPath} {...marketingPageTransition}>
              <Component {...pageProps} />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <main className="flex-1 container py-8 relative z-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={router.asPath} {...pageTransition}>
              <Component {...pageProps} />
            </motion.div>
          </AnimatePresence>
        </main>
      )}

      {!fullBleed && !appLayout && !isAuthPage && !isParlerMarketing && <Footer />}
    </div>
    </TopProgressProvider>
    </ThemeProvider>
  )
}
