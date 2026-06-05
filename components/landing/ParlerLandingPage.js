import { useState } from 'react'
import Link from 'next/link'
import {
  Heart,
  MessageCircle,
  Brain,
  Check,
  X,
  Lock,
} from 'lucide-react'
import VerticalTestimonialsSpin from './VerticalTestimonialsSpin'

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <line x1="3" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Nav() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <nav className="pss-nav sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 py-5">
        <Link href="/" className="pss-nav-logo font-serif text-2xl">
          parlé
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/register"
            className="hidden sm:inline-flex bg-primary text-primary-foreground rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            Start free
          </Link>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-2 text-foreground rounded-full transition hover:opacity-70"
            aria-label="Menu"
            aria-expanded={open}
          >
            <HamburgerIcon />
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-border/40 bg-background/95 pss-menu-enter">
          <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex flex-col gap-3 text-sm">
            <a href="#what" className="py-1 hover:text-primary" onClick={close}>
              What is parlé
            </a>
            <a href="#how" className="py-1 hover:text-primary" onClick={close}>
              How it works
            </a>
            <a href="#voices" className="py-1 hover:text-primary" onClick={close}>
              Voices
            </a>
            <Link href="/chat" className="py-1 hover:text-primary" onClick={close}>
              Talk now
            </Link>
            <Link href="/login" className="py-1 hover:text-primary" onClick={close}>
              Login
            </Link>
            <Link href="/register" className="py-1 hover:text-primary" onClick={close}>
              Sign up
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  )
}

function DictionaryHero() {
  return (
    <section id="what" className="pss-hero-section">
      <div className="pss-hero-inner">
        <div className="pss-hero-block">
          <div className="pss-hero-word">
            <h1 className="pss-hero-title">parlé</h1>
          </div>

          <div className="pss-hero-meta">
            <span className="pss-hero-phonetic">/ par.leɪ /</span>
            <span className="pss-hero-noun">noun</span>
          </div>

          <div className="pss-hero-divider pss-hero-rule" aria-hidden />

          <p className="pss-hero-defs pss-hero-definition">
            A private AI listener for your thoughts, feelings, and heartbreak stories.
          </p>

          <div className="pss-hero-ctas">
            <Link href="/chat" className="pss-hero-btn pss-hero-btn--primary">
              Talk now (no account needed)
            </Link>
            <a href="#how" className="pss-hero-btn pss-hero-btn--secondary">
              See how it works
            </a>
          </div>

          <p className="pss-hero-footnote">
            Free to start · Private by default · Available 24/7
          </p>
        </div>
      </div>
    </section>
  )
}

function ChatMock() {
  return (
    <div className="bg-card rounded-3xl p-6 shadow-2xl pss-shadow-card border border-border/50">
      <div className="flex items-center gap-3 pb-4 border-b border-border/50">
        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
          <Heart className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="font-medium">parlé</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Always here for you
          </div>
        </div>
      </div>
      <div className="space-y-3 py-5">
        <div className="bg-secondary rounded-2xl px-4 py-3 text-sm max-w-[85%]">
          Hey there. I can tell you&apos;re going through something difficult. Want to talk about it?
        </div>
        <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-3 text-sm max-w-[85%] ml-auto">
          I just can&apos;t stop thinking about them...
        </div>
        <div className="bg-secondary rounded-2xl px-4 py-3 text-sm max-w-[85%]">
          That&apos;s completely normal. Missing someone doesn&apos;t follow a timeline. I&apos;m here to listen.
        </div>
      </div>
      <div className="bg-muted rounded-full px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
        <MessageCircle className="w-4 h-4" /> Share what&apos;s on your mind...
      </div>
    </div>
  )
}

function Nights() {
  return (
    <section className="px-6 md:px-12 py-20 md:py-28 pss-section-nights border-y border-border/40">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
        <div>
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">Why parlé exists</p>
          <h2 className="font-serif text-5xl md:text-6xl leading-[1.05] tracking-tight">
            For the nights when you miss them{' '}
            <span className="text-primary italic">and your friends are asleep.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-md">
            A heartbreak support space. Comfort first. Advice only when you&apos;re ready.
          </p>
        </div>
        <ChatMock />
      </div>
    </section>
  )
}

function Compare() {
  const yes = [
    ['Private & safe', 'Encrypted, never shared'],
    ['Remembers your story', 'Context-aware support'],
    ['Available 24/7', 'When friends are asleep'],
    ['No rush to heal', 'Your pace, your journey'],
  ]
  const no = [
    ['Generic responses', 'No personal context'],
    ['Data sold for ads', 'Privacy concerns'],
    ['Friends need sleep', 'Limited availability'],
    ['"Just move on"', 'Rushed healing'],
  ]

  return (
    <div className="mt-20 bg-card rounded-3xl p-8 md:p-12 text-left border border-border/50 shadow-sm">
      <h3 className="font-serif text-2xl md:text-3xl text-center mb-10">parlé vs other support</h3>
      <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
        <div className="space-y-6">
          {yes.map(([t, d]) => (
            <div key={t} className="flex gap-3">
              <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-primary-foreground" />
              </span>
              <div>
                <div className="font-semibold">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          {no.map(([t, d]) => (
            <div key={t} className="flex gap-3 opacity-60">
              <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <X className="w-4 h-4 text-muted-foreground" />
              </span>
              <div>
                <div className="font-semibold">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function How() {
  const items = [
    { icon: MessageCircle, title: 'Share freely', desc: 'Talk as much as you need. No pressure, no judgment.' },
    { icon: Brain, title: 'We remember', desc: 'Your story matters. Context-aware support that understands.' },
    { icon: Lock, title: '100% private', desc: 'Private by default. Never sold or analyzed.' },
  ]

  return (
    <section id="how" className="px-6 md:px-12 py-24">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="font-serif text-4xl md:text-5xl">How parlé works for you</h2>
        <p className="mt-4 text-muted-foreground">Support when you need it. Privacy always.</p>
        <div className="mt-16 grid md:grid-cols-3 gap-10">
          {items.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-5">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-serif text-2xl">{title}</h3>
              <p className="mt-3 text-muted-foreground max-w-xs">{desc}</p>
            </div>
          ))}
        </div>
        <Compare />
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section id="talk" className="px-6 md:px-12 py-24 pss-section-cta text-center">
      <h2 className="font-serif text-4xl md:text-6xl">Need someone right now?</h2>
      <p className="mt-4 text-muted-foreground">Start with one option that matches how you feel — then talk.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/chat"
          className="bg-primary text-primary-foreground rounded-full px-8 py-4 font-medium hover:opacity-90 transition"
        >
          Talk now (no account needed)
        </Link>
        <Link
          href="/register"
          className="bg-card border border-border rounded-full px-8 py-4 font-medium hover:bg-secondary transition"
        >
          Create an account
        </Link>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-primary" /> Free to start
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-primary" /> No credit card
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Check className="w-4 h-4 text-primary" /> Private by default
        </span>
      </div>
    </section>
  )
}

export default function ParlerLandingPage({ signupDeclined = false }) {
  return (
    <main className="parler-landing min-h-screen bg-background text-foreground">
      <Nav />
      {signupDeclined ? (
        <div className="px-6 md:px-10 py-3 bg-accent/40 border-b border-border/40 text-sm text-center" role="status">
          You chose not to accept the Terms &amp; Safety Agreement, so account creation is not available.{' '}
          <Link href="/register" className="text-primary underline underline-offset-2">
            Review the agreement
          </Link>{' '}
          when you are ready.
        </div>
      ) : null}
      <DictionaryHero />
      <Nights />
      <How />
      <VerticalTestimonialsSpin />
      <CTA />
      <footer className="px-6 md:px-12 py-10 text-center text-sm text-muted-foreground">
        <span className="font-serif italic text-lg text-foreground">parlé</span> · A quiet space, always open.{' '}
        <Link href="/terms" className="text-primary hover:underline">
          Terms &amp; Safety
        </Link>
      </footer>
    </main>
  )
}
