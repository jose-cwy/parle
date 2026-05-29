import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MessageCircle, BookHeart, BookOpen, Bookmark } from 'lucide-react'
import { useSavedQuote } from '../../lib/hooks/useSavedQuote'
import { displayName, timeGreeting } from '../../lib/haven/dates'

function SavedQuoteCard({ saved, loading }) {
  if (loading) {
    return (
      <div className="paper p-8 md:p-12">
        <div className="skeleton-soft h-4 w-32 mb-6" />
        <div className="skeleton-soft h-10 w-full max-w-lg mb-4" />
        <div className="skeleton-soft h-10 w-2/3 max-w-md" />
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute -top-1 right-10 z-10 hsc-bookmark group">
        <svg width="26" height="58" viewBox="0 0 26 58" className="drop-shadow-sm">
          <path d="M0 0 H26 V58 L13 47 L0 58 Z" fill="var(--rose)" />
          <path d="M0 0 H26 V58 L13 47 L0 58 Z" fill="url(#bm)" opacity="0.18" />
          <defs>
            <linearGradient id="bm" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="paper relative overflow-hidden p-8 md:p-12">
        <div className="absolute left-6 top-6 bottom-6 w-px bg-border/70" aria-hidden />
        <div className="absolute left-3 top-6 bottom-6 w-px bg-border/40" aria-hidden />

        <div className="pl-6 md:pl-10">
          <p className="text-[11px] uppercase tracking-[0.26em] text-clay/90 flex items-center gap-2">
            <Bookmark size={12} strokeWidth={1.8} className="text-rose" />
            A line you kept close
          </p>

          {saved ? (
            <>
              <blockquote className="mt-6 font-serif text-2xl md:text-[34px] leading-[1.25] text-foreground max-w-2xl">
                <span className="font-serif text-clay/40 text-4xl align-[-0.2em] mr-1">&ldquo;</span>
                {saved.text}
                <span className="font-serif text-clay/40 text-4xl align-[-0.4em] ml-1">&rdquo;</span>
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-px w-10 bg-clay/60" />
                <p className="text-xs tracking-wide text-muted-foreground">
                  — {saved.author} · <span className="italic">{saved.chapter}</span>
                </p>
              </div>
            </>
          ) : (
            <div className="mt-6">
              <p className="font-serif text-2xl text-muted-foreground italic">No quote saved yet.</p>
              <Link
                href="/quotes"
                className="inline-block mt-4 text-sm text-clay underline underline-offset-4"
              >
                Open the quote book →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NoteCard({ href, icon: Icon, kicker, title, sub, doodle, delay }) {
  return (
    <Link href={href} className={`paper-note lift block p-6 rise ${delay} relative overflow-hidden`}>
      <div className="flex items-center gap-2 text-clay">
        <Icon size={15} strokeWidth={1.7} className="text-clay" />
        <p className="text-[10.5px] uppercase tracking-[0.24em]">{kicker}</p>
      </div>
      <h3 className="mt-4 font-serif text-[22px] text-foreground leading-snug">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sub}</p>

      <svg className="mt-5 text-rose/70" width="80" height="14" viewBox="0 0 80 14" fill="none" aria-hidden>
        {doodle === 'squiggle' && (
          <path
            d="M2 8 Q 10 2, 18 8 T 34 8 T 50 8 T 66 8 T 78 8"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {doodle === 'underline' && (
          <path
            d="M2 9 C 20 6, 50 6, 78 9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {doodle === 'dots' &&
          [6, 18, 30, 42, 54, 66, 76].map((x) => (
            <circle key={x} cx={x} cy="8" r="1.4" fill="currentColor" />
          ))}
      </svg>
    </Link>
  )
}

export default function HavenDashboard({ user }) {
  const { saved, loading } = useSavedQuote()
  const [today, setToday] = useState('')

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    )
  }, [])

  const name = displayName(user)

  return (
    <div className="space-y-12">
      <section className="rise">
        <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground min-h-[14px]">
          {today || '\u00A0'}
        </p>
        <h1 className="mt-3 text-4xl md:text-5xl text-foreground leading-[1.05]">
          {timeGreeting()}, <span className="italic text-clay">{name}.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground leading-relaxed">
          This is your room. No one else is here. Take your time.
        </p>
      </section>

      <section className="rise rise-1">
        <SavedQuoteCard saved={saved} loading={loading} />
      </section>

      <section>
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground mb-4">Quick access</p>
        <div className="grid md:grid-cols-3 gap-5">
          <NoteCard
            href="/chat"
            icon={MessageCircle}
            kicker="AI Chatbot"
            title="Talk it through"
            sub="Continue your private conversation."
            doodle="squiggle"
            delay="rise-2"
          />
          <NoteCard
            href="/diary"
            icon={BookHeart}
            kicker="Diary"
            title="Write today"
            sub="Put your thoughts somewhere safe."
            doodle="underline"
            delay="rise-3"
          />
          <NoteCard
            href="/quotes"
            icon={BookOpen}
            kicker="Quotes Book"
            title="Open your quote book"
            sub="Find words to hold onto."
            doodle="dots"
            delay="rise-4"
          />
        </div>
      </section>
    </div>
  )
}
