import '../styles/globals.css'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Head from 'next/head'

export default function App({ Component, pageProps }){
  return (
    <div className="min-h-screen flex flex-col">
      <Head>
        <title>Heartstrings Club | Teen Heartbreak Support Website</title>
        <meta name="description" content="Heartstrings Club is a teen heartbreak support website with private diary, emotional support chatbot, and healing quotes." />
        <meta name="keywords" content="teen heartbreak support website, breakup support for teens, healing quotes, private diary" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Header />
      <main className="flex-1 container py-8">
        <Component {...pageProps} />
      </main>
      <Footer />
    </div>
  )
}
