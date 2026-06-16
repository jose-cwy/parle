import { useLayoutEffect, useRef } from 'react'
import { cn } from '../../../lib/cn'
import { defaultIntro } from '../../../lib/haven/bookQuotesUi'

function quoteSizeClass(text) {
  const len = text?.length ?? 0
  if (len < 60) return 'haven-quotes-book__quote-text--short'
  if (len < 120) return 'haven-quotes-book__quote-text--medium'
  return 'haven-quotes-book__quote-text--long'
}

function MeasureQuoteBlock({ quote }) {
  return (
    <div className="haven-quotes-book__quote">
      <blockquote
        className={cn(
          'haven-quotes-book__quote-text font-serif text-foreground',
          quoteSizeClass(quote.text),
        )}
      >
        {quote.text}
      </blockquote>
      <div className="haven-quotes-book__quote-meta">
        <p className="haven-quotes-book__quote-author">— {quote.author || 'Unknown'}</p>
        <div className="haven-quotes-book__quote-bookmark haven-quotes-book__quote-bookmark--measure">
          Keep this line
        </div>
      </div>
    </div>
  )
}

export default function BookMeasureLayer({ quotes, chapter, panelWidth, onMeasured }) {
  const headerRef = useRef(null)
  const quoteRefs = useRef([])

  useLayoutEffect(() => {
    if (!panelWidth) return

    quoteRefs.current = quoteRefs.current.slice(0, quotes.length)

    const quoteHeights = quotes.map((_, i) => quoteRefs.current[i]?.offsetHeight ?? 0)
    const spread1HeaderHeight = headerRef.current?.offsetHeight ?? 0

    onMeasured({ quoteHeights, spread1HeaderHeight })
  }, [quotes, chapter, panelWidth, onMeasured])

  if (!panelWidth) return null

  return (
    <div
      className="haven-quotes-book__measure"
      aria-hidden="true"
      style={{ width: panelWidth }}
    >
      <div ref={headerRef} className="haven-quotes-book__spread1-header">
        <p className="haven-quotes-book__chapter-label">Chapter</p>
        <h2 className="haven-quotes-book__chapter-title font-serif">{chapter}</h2>
        <p className="haven-quotes-book__chapter-desc">{defaultIntro(chapter)}</p>
        <hr className="haven-quotes-book__chapter-divider" aria-hidden="true" />
      </div>

      {quotes.map((quote, index) => (
        <div
          key={quote.id}
          ref={(el) => {
            quoteRefs.current[index] = el
          }}
        >
          <MeasureQuoteBlock quote={quote} />
        </div>
      ))}
    </div>
  )
}
