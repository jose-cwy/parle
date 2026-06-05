import { useEffect, useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useSavedQuote } from '../../lib/hooks/useSavedQuote'

const CHAPTER_INTROS = {
  Heartbreak:
    'For the first nights, when the room is too quiet and the phone is too loud.',
  Healing: 'For the days you are learning to breathe again.',
  'Self-Worth': 'For remembering that being left does not make you less.',
  'Letting Go': 'For loosening your grip without denying what mattered.',
  'Moving On': 'For the small steps forward, even when they feel quiet.',
}

function defaultIntro(chapter) {
  return CHAPTER_INTROS[chapter] || 'Words for where you are right now.'
}

function QuoteAttribution({ quote }) {
  return (
    <p className="text-[12px] text-muted-foreground leading-snug">
      — {quote.author || 'Unknown'}
    </p>
  )
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
      <div className="mt-3 flex items-start justify-between gap-3">
        <QuoteAttribution quote={quote} />
        <button
          type="button"
          onClick={() => onSave(quote, chapter)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] transition-all shrink-0',
            saved
              ? 'bg-rose/15 text-clay border border-rose/40'
              : 'text-muted-foreground hover:text-clay border border-transparent hover:bg-secondary',
          )}
          aria-pressed={saved}
        >
          {saved ? <BookmarkCheck size={13} strokeWidth={2} /> : <Bookmark size={13} strokeWidth={1.7} />}
          {saved ? 'Kept' : 'Keep this line'}
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
        <h1 className="mt-2 text-3xl md:text-4xl text-foreground leading-snug">
          A line <span className="italic text-clay">to hold on to.</span>
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground leading-relaxed">
          A quiet book of lines for the moments you cannot find your own.
        </p>
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
                'linear-gradient(90deg, #fdfbf7 0%, #f5f0ea 49%, #e8e4de 50%, #f5f0ea 51%, #fdfbf7 100%)',
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
                <p className="text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
                  Opening line
                </p>
                {featured && (
                  <QuoteBlock
                    quote={featured}
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
                      quote={q}
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

      <div
        className={cn(
          'rise rise-2 relative overflow-hidden rounded-[22px] border p-6 md:p-7',
          saved
            ? 'border-rose/30 bg-gradient-to-br from-secondary/90 via-card to-secondary/50'
            : 'border-border bg-secondary/40',
        )}
      >
        <div
          className="absolute -top-px right-10 h-8 w-5 rounded-b-sm bg-rose/80 shadow-sm"
          aria-hidden
        />
        <div className="flex items-start gap-4">
          <Bookmark
            size={16}
            strokeWidth={1.8}
            className={cn('mt-0.5 shrink-0', saved ? 'text-rose' : 'text-muted-foreground')}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
              {saved ? 'The line you are carrying' : 'Your carried line'}
            </p>
            {saved ? (
              <>
                <p className="font-serif text-[18px] md:text-[19px] mt-2 text-foreground leading-snug">
                  &ldquo;{saved.text}&rdquo;
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">— {saved.author}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {saved.chapter} · on your home page
                </p>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Saving another line replaces this one. Only one stays close at a time.
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-[17px] mt-2 text-muted-foreground italic">
                  No line kept yet.
                </p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  When a line feels right, keep it — it will appear on your home page as the one
                  you carry.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
