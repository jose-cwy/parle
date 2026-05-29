import { useEffect, useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useSavedQuote } from '../../lib/hooks/useSavedQuote'

const CHAPTER_INTROS = {
  Heartbreak:
    "For the first nights. When the room is too quiet and the phone is too loud. You don't have to make sense of it yet.",
  Healing:
    "For the slow days. The ones that don't show progress until you look back and notice you can breathe a little deeper.",
  'Moving On':
    "Not forgetting. Just walking forward with the parts of yourself you found along the way.",
  'Self-Love':
    "A reminder of the person you were before — and the one you're becoming, kinder this time.",
  'Self-Worth':
    "A reminder of the person you were before — and the one you're becoming, kinder this time.",
  Reflection: 'For the days when looking back helps you understand where you are now.',
  Inspiration: 'Small sparks for when the path ahead feels dim.',
  'Letting Go': 'Releasing isn\'t losing. Some things become beautiful only after we set them down.',
}

function defaultIntro(chapter) {
  return CHAPTER_INTROS[chapter] || 'Words for where you are right now.'
}

function QuoteBlock({ quote, chapter, saved, onSave, large }) {
  return (
    <div className="group">
      <blockquote
        className={cn(
          'font-serif text-foreground leading-snug',
          large ? 'text-2xl md:text-[26px] mt-3' : 'text-[18px] md:text-[19px]',
        )}
      >
        {quote.text}
      </blockquote>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground italic">— {quote.author || 'Unknown'}</p>
        <button
          type="button"
          onClick={() => onSave(quote, chapter)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] transition-all shrink-0',
            saved
              ? 'bg-rose/15 text-clay border border-rose/40'
              : 'text-muted-foreground hover:text-clay border border-transparent hover:bg-secondary',
          )}
        >
          {saved ? <BookmarkCheck size={13} strokeWidth={2} /> : <Bookmark size={13} strokeWidth={1.7} />}
          {saved ? 'Kept' : 'Keep this'}
        </button>
      </div>
    </div>
  )
}

export default function HavenQuotes() {
  const [chapters, setChapters] = useState(null)
  const [active, setActive] = useState('')
  const [fadeKey, setFadeKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { saved, toggleQuote } = useSavedQuote()

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch('/api/quotes')
      .then((r) => {
        if (!r.ok) throw new Error('Unable to load quotes.')
        return r.json()
      })
      .then((data) => {
        setChapters(data)
        setActive(Object.keys(data)[0] || '')
      })
      .catch((err) => {
        setError(err.message || 'Unable to load quotes.')
        setChapters({})
      })
      .finally(() => setLoading(false))
  }, [])

  async function markRead() {
    await fetch('/api/quotes/read', { method: 'POST' }).catch(() => null)
  }

  function pickChapter(c) {
    if (c === active) return
    setActive(c)
    setFadeKey((k) => k + 1)
    markRead()
  }

  if (loading) {
    return (
      <div className="space-y-7">
        <div className="skeleton-soft h-10 w-72" />
        <div className="skeleton-soft h-[420px]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="paper p-8 text-center" role="alert">
        <p className="font-serif text-xl">Quotes could not load</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  const chapterNames = Object.keys(chapters || {})
  if (!chapterNames.length) {
    return (
      <div className="paper p-8 text-center">
        <p className="font-serif text-xl">No quotes yet</p>
        <p className="mt-2 text-sm text-muted-foreground">Check back soon for new chapters.</p>
      </div>
    )
  }

  const quotes = chapters[active] || []
  const featured = quotes[0]
  const rest = quotes.slice(1)

  return (
    <div className="space-y-7">
      <header className="rise">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Quotes Book</p>
        <h1 className="mt-2 text-3xl md:text-4xl text-foreground">
          Borrow a line. <span className="italic text-clay">Keep one close.</span>
        </h1>
      </header>

      <div className="rise rise-1 grid md:grid-cols-[160px_minmax(0,1fr)] gap-5 items-start">
        <nav className="md:sticky md:top-8 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
          <p className="hidden md:block text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-2 px-2">
            Chapters
          </p>
          {chapterNames.map((c) => {
            const isActive = c === active
            return (
              <button
                key={c}
                type="button"
                onClick={() => pickChapter(c)}
                className={cn(
                  'relative text-left whitespace-nowrap px-3.5 py-2.5 rounded-xl text-[13.5px] transition-colors',
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-clay" />
                )}
                <span className="font-serif text-[15px]">{c}</span>
              </button>
            )
          })}
        </nav>

        <div className="relative">
          <div
            className="relative grid md:grid-cols-2 rounded-[26px] overflow-hidden border border-border shadow-soft"
            style={{
              background:
                'linear-gradient(90deg, oklch(0.975 0.018 78) 0%, oklch(0.97 0.022 76) 49%, oklch(0.9 0.025 65) 50%, oklch(0.97 0.022 76) 51%, oklch(0.975 0.018 78) 100%)',
            }}
          >
            <div key={`L-${fadeKey}`} className="p-7 md:p-10 min-h-[420px] page-fade">
              <p className="text-[11px] uppercase tracking-[0.26em] text-clay">Chapter</p>
              <h2 className="font-serif text-3xl md:text-4xl mt-2 text-foreground">{active}</h2>
              <div className="mt-4 h-px w-12 bg-clay/60" />
              <p className="mt-6 font-serif text-[17px] leading-8 text-foreground/85 italic">
                {defaultIntro(active)}
              </p>

              <div className="mt-8 pt-6 border-t border-dashed border-border">
                <p className="text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">Featured</p>
                {featured && (
                  <QuoteBlock
                    quote={{ ...featured, author: featured.author || 'Unknown' }}
                    chapter={active}
                    saved={saved?.id === featured.id}
                    onSave={toggleQuote}
                    large
                  />
                )}
              </div>
            </div>

            <div key={`R-${fadeKey}`} className="p-7 md:p-10 min-h-[420px] page-fade">
              <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                More from this chapter
              </p>
              <ul className="mt-5 space-y-7">
                {rest.map((q) => (
                  <li key={q.id}>
                    <QuoteBlock
                      quote={{ ...q, author: q.author || 'Unknown' }}
                      chapter={active}
                      saved={saved?.id === q.id}
                      onSave={toggleQuote}
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-10 text-center text-[10.5px] text-muted-foreground/80 tracking-widest">
                · · ·
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rise rise-2 paper-note p-5 flex items-start gap-4">
        <Bookmark size={16} strokeWidth={1.8} className="text-rose mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            Currently kept on your home page
          </p>
          {saved ? (
            <p className="font-serif text-[17px] mt-1.5 text-foreground">
              &ldquo;{saved.text}&rdquo;{' '}
              <span className="text-muted-foreground text-sm">— {saved.author}</span>
            </p>
          ) : (
            <p className="font-serif text-[17px] mt-1.5 text-muted-foreground italic">Nothing kept yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
