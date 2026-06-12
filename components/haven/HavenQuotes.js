import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Bookmark, BookmarkCheck, Search } from 'lucide-react'
import HavenPageTopbar from './HavenPageTopbar'
import { cn } from '../../lib/cn'
import { QuoteTextContent, quoteSizeClass } from '../../lib/haven/bookQuotesUi'
import { useSavedQuote } from '../../lib/hooks/useSavedQuote'
import { useTopProgress } from '../../lib/hooks/useTopProgress'

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i * 0.04, 0.24), duration: 0.28, ease: 'easeOut' },
  }),
}

function formatMeta(author) {
  return `— ${(author || 'Unknown').toUpperCase()}`
}

function QuoteCard({ quote, chapter, isSaved, onToggle, index = 0, reduceMotion }) {
  return (
    <motion.article
      className={cn('haven-quotes__card', isSaved && 'haven-quotes__card--saved')}
      variants={reduceMotion ? undefined : cardVariants}
      initial={reduceMotion ? false : 'hidden'}
      animate="show"
      custom={index}
    >
      <span className="haven-quotes__card-mark font-serif" aria-hidden>
        &ldquo;
      </span>
      <button
        type="button"
        className={cn(
          'haven-quotes__card-save',
          isSaved && 'haven-quotes__card-save--active',
        )}
        onClick={() => onToggle(quote, chapter)}
        aria-pressed={isSaved}
        aria-label={isSaved ? 'Remove saved line' : 'Save this line'}
        title={isSaved ? 'Saved' : 'Save this line'}
      >
        {isSaved ? (
          <BookmarkCheck size={17} strokeWidth={2} />
        ) : (
          <Bookmark size={17} strokeWidth={1.75} />
        )}
      </button>
      <blockquote
        className={cn(
          'haven-quotes__card-text font-serif',
          quoteSizeClass(quote.text),
        )}
      >
        <QuoteTextContent text={quote.text} />
      </blockquote>
      <p className="haven-quotes__card-meta">{formatMeta(quote.author)}</p>
    </motion.article>
  )
}

export default function HavenQuotes() {
  const reduceMotion = useReducedMotion()
  const [chapters, setChapters] = useState(null)
  const [active, setActive] = useState('')
  const [view, setView] = useState('chapter')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { saved, toggleQuote } = useSavedQuote()

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

  const markRead = useCallback(async () => {
    await fetch('/api/quotes/read', { method: 'POST' }).catch(() => null)
  }, [])

  const pickChapter = useCallback(
    (chapter) => {
      if (chapter === active && view === 'chapter') return
      setView('chapter')
      setActive(chapter)
      setSearch('')
      markRead()
    },
    [active, view, markRead],
  )

  const pickSaved = useCallback(() => {
    setView('saved')
    setSearch('')
  }, [])

  const quotes = chapters?.[active] || []

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return quotes
    return quotes.filter((q) => {
      const text = `${q.text || ''} ${q.author || ''}`.toLowerCase()
      return text.includes(query)
    })
  }, [quotes, search])

  const savedCount = saved ? 1 : 0
  const chapterNames = Object.keys(chapters || {})

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

  if (!chapterNames.length) {
    return (
      <div className="paper p-8 text-center">
        <p className="font-serif text-xl">No quotes yet</p>
        <p className="mt-2 text-sm text-muted-foreground">Check back soon for new chapters.</p>
      </div>
    )
  }

  const entryLabel =
    filteredQuotes.length === 1 ? '1 ENTRY' : `${filteredQuotes.length} ENTRIES`

  return (
    <div className="haven-quotes">
      <HavenPageTopbar label="Quotes" />

      <section className="haven-quotes__hero">
        <h1 className="haven-quotes__title font-serif">
          Quiet words for loud feelings.
        </h1>
        <p className="haven-quotes__subtitle">
          Wander the chapters. Tap the ribbon to keep the ones that find you.
        </p>
      </section>

      <div className="haven-quotes__layout">
        <aside className="haven-quotes__sidebar">
          <nav className="haven-quotes__chapter-nav" aria-label="Chapters">
            <p className="haven-quotes__nav-label">Chapters</p>
            <ul className="haven-quotes__chapter-list">
              {chapterNames.map((chapter) => {
                const isActive = view === 'chapter' && chapter === active
                return (
                  <li key={chapter}>
                    <button
                      type="button"
                      onClick={() => pickChapter(chapter)}
                      className={cn(
                        'haven-quotes__chapter-btn',
                        isActive && 'haven-quotes__chapter-btn--active',
                      )}
                    >
                      {isActive ? (
                        <span className="haven-quotes__chapter-accent" aria-hidden />
                      ) : null}
                      <span className="font-serif">{chapter}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <button
            type="button"
            className={cn(
              'haven-quotes__saved-btn',
              view === 'saved' && 'haven-quotes__saved-btn--active',
            )}
            onClick={pickSaved}
          >
            <Bookmark size={15} strokeWidth={1.75} aria-hidden />
            <span>Saved</span>
            <span className="haven-quotes__saved-count" aria-label={`${savedCount} saved`}>
              {savedCount}
            </span>
          </button>
        </aside>

        <main className="haven-quotes__main">
          {view === 'saved' ? (
            <>
              <div className="haven-quotes__main-head">
                <h2 className="haven-quotes__main-title font-serif">Saved</h2>
                <span className="haven-quotes__entry-count">{savedCount} KEPT</span>
              </div>

              {saved ? (
                <div className="haven-quotes__grid haven-quotes__grid--single">
                  <QuoteCard
                    quote={saved}
                    chapter={saved.chapter}
                    isSaved
                    onToggle={toggleQuote}
                    index={0}
                    reduceMotion={reduceMotion}
                  />
                  <p className="haven-quotes__saved-note">
                    This line appears on your home page. Saving another replaces it.
                  </p>
                </div>
              ) : (
                <div className="haven-quotes__empty">
                  <Bookmark size={22} strokeWidth={1.5} className="text-muted-foreground" />
                  <p className="font-serif text-lg text-foreground mt-4">No line kept yet.</p>
                  <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">
                    When a line feels right, tap the ribbon on any quote — it will appear on your
                    home page as the one you carry.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <label className="haven-quotes__search">
                <Search size={16} strokeWidth={1.75} aria-hidden className="haven-quotes__search-icon" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search this chapter..."
                  className="haven-quotes__search-input"
                  aria-label="Search this chapter"
                />
              </label>

              <div className="haven-quotes__main-head">
                <h2 className="haven-quotes__main-title font-serif">{active}</h2>
                <span className="haven-quotes__entry-count">{entryLabel}</span>
              </div>

              {filteredQuotes.length > 0 ? (
                <div className="haven-quotes__grid">
                  {filteredQuotes.map((quote, index) => (
                    <QuoteCard
                      key={quote.id}
                      quote={quote}
                      chapter={active}
                      isSaved={saved?.id === quote.id}
                      onToggle={toggleQuote}
                      index={index}
                      reduceMotion={reduceMotion}
                    />
                  ))}
                </div>
              ) : (
                <div className="haven-quotes__empty">
                  <p className="font-serif text-lg text-foreground">No matches</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try a different word — or clear the search to see every line in this chapter.
                  </p>
                  <button
                    type="button"
                    className="haven-quotes__clear-search"
                    onClick={() => setSearch('')}
                  >
                    Clear search
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
