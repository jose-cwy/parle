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
import MarketingNav from './MarketingNav'

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
            A private space to say the things you can&apos;t say out loud.
          </p>

          <div className="pss-hero-ctas">
            <Link href="/chat" className="pss-hero-btn pss-hero-btn--primary">
              Start talking
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
    <div className="pss-compare">
      <h3 className="pss-compare__title font-serif text-2xl md:text-3xl">parlé vs other support</h3>
      <div className="pss-compare__grid">
        <div className="pss-compare__col">
          {yes.map(([t, d]) => (
            <div key={t} className="pss-compare__item">
              <span className="pss-compare__icon pss-compare__icon--yes">
                <Check className="w-4 h-4 text-primary-foreground" />
              </span>
              <div className="pss-compare__copy">
                <div className="font-semibold">{t}</div>
                <div className="text-sm text-muted-foreground">{d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="pss-compare__col">
          {no.map(([t, d]) => (
            <div key={t} className="pss-compare__item pss-compare__item--muted">
              <span className="pss-compare__icon pss-compare__icon--no">
                <X className="w-4 h-4 text-muted-foreground" />
              </span>
              <div className="pss-compare__copy">
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
          Start talking
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
      <MarketingNav />
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
        {' · '}
        <Link href="/contact" className="text-primary hover:underline">
          Contact
        </Link>
      </footer>
    </main>
  )
}
