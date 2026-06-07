import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { cn } from '../../lib/cn'
import { buildFallbackSpreads, buildSpreads, getPanelDimensions } from '../../lib/haven/bookLayout'
import { defaultIntro, QuoteTextContent, quoteSizeClass } from '../../lib/haven/bookQuotesUi'
import { useSavedQuote } from '../../lib/hooks/useSavedQuote'
import { useTopProgress } from '../../lib/hooks/useTopProgress'
import BookMeasureLayer from './BookMeasureLayer'

const PAGE_SLIDE = {
  duration: 0.3,
  ease: 'easeInOut',
}

const spreadVariants = {
  enter: (d) => ({
    opacity: 0,
    x: d > 0 ? 40 : -40,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (d) => ({
    opacity: 0,
    x: d > 0 ? -40 : 40,
  }),
}

function CornerFlourish({ className }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 20 L4 4 L20 4"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M4 8 Q8 4 14 4"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  )
}

function QuoteAttribution({ quote }) {
  return (
    <p className="haven-quotes-book__quote-author">
      — {quote.author || 'Unknown'}
    </p>
  )
}

function QuoteBlock({ quote, chapter, saved, onSave }) {
  const isSaved = saved?.id === quote.id

  return (
    <div className="haven-quotes-book__quote">
      <blockquote
        className={cn(
          'haven-quotes-book__quote-text font-serif text-foreground',
          quoteSizeClass(quote.text),
        )}
      >
        <QuoteTextContent text={quote.text} />
      </blockquote>
      <div className="haven-quotes-book__quote-meta">
        <QuoteAttribution quote={quote} />
        <button
          type="button"
          onClick={() => onSave(quote, chapter)}
          className={cn(
            'haven-quotes-book__quote-bookmark inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] transition-all shrink-0',
            isSaved
              ? 'bg-rose/15 text-clay border border-rose/40'
              : 'text-muted-foreground hover:text-clay border border-transparent hover:bg-secondary',
          )}
          aria-pressed={isSaved}
        >
          {isSaved ? <BookmarkCheck size={13} strokeWidth={2} /> : <Bookmark size={13} strokeWidth={1.7} />}
          {isSaved ? 'Kept' : 'Keep this line'}
        </button>
      </div>
    </div>
  )
}

function PanelQuoteList({ quotes, chapter, saved, onSave, showMoreComing }) {
  return (
    <div className="haven-quotes-book__panel-quotes">
      {quotes.map((quote) => (
        <QuoteBlock
          key={quote.id}
          quote={quote}
          chapter={chapter}
          saved={saved}
          onSave={onSave}
        />
      ))}
      {showMoreComing ? (
        <p className="haven-quotes-book__more-quotes">More quotes coming...</p>
      ) : null}
    </div>
  )
}

function Spread1LeftPanel({ chapter, quotes, saved, onSave, showMoreComing }) {
  return (
    <div className="haven-quotes-book__page haven-quotes-book__page--left">
      <div className="haven-quotes-book__page-inner haven-quotes-book__page-inner--spread1">
        <div className="haven-quotes-book__spread1-header">
          <p className="haven-quotes-book__chapter-label">Chapter</p>
          <h2 className="haven-quotes-book__chapter-title font-serif">{chapter}</h2>
          <p className="haven-quotes-book__chapter-desc">{defaultIntro(chapter)}</p>
          <hr className="haven-quotes-book__chapter-divider" aria-hidden="true" />
        </div>
        <PanelQuoteList
          quotes={quotes}
          chapter={chapter}
          saved={saved}
          onSave={onSave}
          showMoreComing={showMoreComing}
        />
      </div>
    </div>
  )
}

function QuotePanel({ side, quotes, chapter, saved, onSave, showMoreComing }) {
  return (
    <div
      className={cn(
        'haven-quotes-book__page',
        side === 'left' ? 'haven-quotes-book__page--left' : 'haven-quotes-book__page--right',
      )}
    >
      <div className="haven-quotes-book__page-inner haven-quotes-book__page-inner--quotes">
        <PanelQuoteList
          quotes={quotes}
          chapter={chapter}
          saved={saved}
          onSave={onSave}
          showMoreComing={showMoreComing}
        />
      </div>
    </div>
  )
}

function BookSpread({ spread, chapter, saved, onSave }) {
  if (spread.leftIsChapter) {
    return (
      <div className="haven-quotes-book__spread">
        <Spread1LeftPanel
          chapter={chapter}
          quotes={spread.left}
          saved={saved}
          onSave={onSave}
          showMoreComing={spread.leftShowMore}
        />
        <QuotePanel
          side="right"
          quotes={spread.right}
          chapter={chapter}
          saved={saved}
          onSave={onSave}
          showMoreComing={spread.rightShowMore}
        />
      </div>
    )
  }

  return (
    <div className="haven-quotes-book__spread">
      <QuotePanel
        side="left"
        quotes={spread.left}
        chapter={chapter}
        saved={saved}
        onSave={onSave}
        showMoreComing={spread.leftShowMore}
      />
      <QuotePanel
        side="right"
        quotes={spread.right}
        chapter={chapter}
        saved={saved}
        onSave={onSave}
        showMoreComing={spread.rightShowMore}
      />
    </div>
  )
}

export default function HavenQuotes() {
  const [chapters, setChapters] = useState(null)
  const [active, setActive] = useState('')
  const [spread, setSpread] = useState(0)
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [panelDims, setPanelDims] = useState({ panelHeight: 0, panelWidth: 0 })
  const [measures, setMeasures] = useState(null)
  const { saved, toggleQuote } = useSavedQuote()
  const reduceMotion = useReducedMotion()
  const bookRef = useRef(null)

  useTopProgress(loading)

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

  const updatePanelDims = useCallback(() => {
    if (!bookRef.current) return
    setPanelDims(getPanelDimensions(bookRef.current))
  }, [])

  useEffect(() => {
    updatePanelDims()
    if (!bookRef.current) return undefined

    const observer = new ResizeObserver(updatePanelDims)
    observer.observe(bookRef.current)
    window.addEventListener('resize', updatePanelDims)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updatePanelDims)
    }
  }, [updatePanelDims, loading])

  const handleMeasured = useCallback((next) => {
    setMeasures(next)
  }, [])

  async function markRead() {
    await fetch('/api/quotes/read', { method: 'POST' }).catch(() => null)
  }

  function pickChapter(c) {
    if (c === active) return
    setActive(c)
    setSpread(0)
    setDirection(1)
    setMeasures(null)
    markRead()
  }

  const quotes = chapters?.[active] || []

  const spreads = useMemo(() => {
    if (!quotes.length) {
      return [{ left: [], right: [], leftIsChapter: true, leftShowMore: false, rightShowMore: false }]
    }

    if (!measures || !panelDims.panelHeight) {
      return buildFallbackSpreads(quotes)
    }

    return buildSpreads(quotes, {
      panelHeight: panelDims.panelHeight,
      quoteHeights: measures.quoteHeights,
      spread1HeaderHeight: measures.spread1HeaderHeight,
    })
  }, [quotes, measures, panelDims.panelHeight])

  const totalSpreads = spreads.length
  const safeSpread = Math.min(spread, Math.max(totalSpreads - 1, 0))
  const currentSpread = spreads[safeSpread]

  useEffect(() => {
    if (spread > totalSpreads - 1) {
      setSpread(Math.max(0, totalSpreads - 1))
    }
  }, [spread, totalSpreads])

  function goPrev() {
    if (safeSpread <= 0) return
    setDirection(-1)
    setSpread((s) => Math.max(0, s - 1))
  }

  function goNext() {
    if (safeSpread >= totalSpreads - 1) return
    setDirection(1)
    setSpread((s) => Math.min(totalSpreads - 1, s + 1))
  }

  if (loading) {
    return null
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

  const showPager = totalSpreads > 1
  const spreadKey = `${active}-${safeSpread}-${totalSpreads}`

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
        <nav className="md:sticky md:top-8 flex md:flex-col gap-0 overflow-x-auto md:overflow-visible haven-quotes-book__chapter-nav">
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
                  'haven-quotes-book__chapter-btn relative text-left whitespace-nowrap px-3.5 py-2.5 rounded-xl text-[13.5px] transition-colors',
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
          <div ref={bookRef} className="haven-quotes-book">
            <CornerFlourish className="haven-quotes-book__corner haven-quotes-book__corner--tl" />
            <CornerFlourish className="haven-quotes-book__corner haven-quotes-book__corner--tr" />
            <CornerFlourish className="haven-quotes-book__corner haven-quotes-book__corner--bl" />
            <CornerFlourish className="haven-quotes-book__corner haven-quotes-book__corner--br" />

            <BookMeasureLayer
              key={active}
              quotes={quotes}
              chapter={active}
              panelWidth={panelDims.panelWidth}
              onMeasured={handleMeasured}
            />

            <div className="haven-quotes-book__spread-stage">
              {currentSpread ? (
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={spreadKey}
                    custom={direction}
                    variants={reduceMotion ? undefined : spreadVariants}
                    initial={reduceMotion ? false : 'enter'}
                    animate="center"
                    exit="exit"
                    transition={PAGE_SLIDE}
                    className="haven-quotes-book__spread-motion"
                  >
                    <BookSpread
                      spread={currentSpread}
                      chapter={active}
                      saved={saved}
                      onSave={toggleQuote}
                    />
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>
          </div>

          {showPager ? (
            <nav className="haven-quotes-book__pager" aria-label="Quote pages">
              <button
                type="button"
                className="haven-quotes-book__pager-btn"
                onClick={goPrev}
                disabled={safeSpread <= 0}
                aria-label="Previous page"
              >
                ←
              </button>
              <span className="haven-quotes-book__pager-count" aria-live="polite">
                {safeSpread + 1} / {totalSpreads}
              </span>
              <button
                type="button"
                className="haven-quotes-book__pager-btn"
                onClick={goNext}
                disabled={safeSpread >= totalSpreads - 1}
                aria-label="Next page"
              >
                →
              </button>
            </nav>
          ) : null}
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
