import '../styles/globals.css'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Head from 'next/head'
import { Manrope, Cormorant_Garamond } from 'next/font/google'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/router'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-serif' })

export default function App({ Component, pageProps }){
  const router = useRouter()

  return (
    <div className={`${manrope.variable} ${cormorant.variable} min-h-screen flex flex-col app-shell`}>
      <Head>
        <title>Heartstrings Club | Teen Heartbreak Support Website</title>
        <meta name="description" content="Heartstrings Club is a teen heartbreak support website with private diary, emotional support chatbot, and healing quotes." />
        <meta name="keywords" content="teen heartbreak support website, breakup support for teens, healing quotes, private diary" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="page-noise" />
      <div className="page-glow page-glow-one" />
      <div className="page-glow page-glow-two" />
      <Header />
      <main className="flex-1 container py-8 relative z-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={router.asPath}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
