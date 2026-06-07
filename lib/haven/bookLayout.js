export const PANEL_PADDING = 28
export const QUOTE_GAP = 28

export function getPanelDimensions(bookEl) {
  if (!bookEl) return { panelHeight: 0, panelWidth: 0 }

  const { width, height } = bookEl.getBoundingClientRect()
  const isWide = window.matchMedia('(min-width: 768px)').matches

  return {
    panelHeight: isWide ? height : height / 2,
    panelWidth: isWide ? width / 2 : width,
  }
}

export function buildSpreads(quotes, { panelHeight, quoteHeights, spread1HeaderHeight }) {
  if (!panelHeight || !quotes.length) {
    return [{ left: [], right: [], leftIsChapter: true, leftShowMore: false, rightShowMore: false }]
  }

  const availableFull = panelHeight - PANEL_PADDING * 2
  const spreads = []
  let index = 0
  let spreadIndex = 0

  while (index < quotes.length) {
    const spread = {
      left: [],
      right: [],
      leftIsChapter: spreadIndex === 0,
      leftShowMore: false,
      rightShowMore: false,
    }

    const leftAvailable =
      spreadIndex === 0 ? availableFull - (spread1HeaderHeight || 0) : availableFull

    index = fillPanel(spread.left, quotes, index, leftAvailable, quoteHeights)
    index = fillPanel(spread.right, quotes, index, availableFull, quoteHeights)

    if (spread.left.length === 0 && spread.right.length === 0 && index < quotes.length) {
      const target = spreadIndex === 0 && spread.leftIsChapter ? spread.left : spread.right
      target.push(quotes[index])
      index += 1
    }

    spreads.push(spread)
    spreadIndex += 1

    if (spreadIndex > quotes.length * 2) break
  }

  if (!spreads.length) {
    spreads.push({
      left: [],
      right: [],
      leftIsChapter: true,
      leftShowMore: false,
      rightShowMore: false,
    })
  }

  if (quotes.length > 0) {
    const lastSpread = spreads[spreads.length - 1]
    if (lastSpread.right.length > 0) {
      lastSpread.rightShowMore = true
    } else if (lastSpread.left.length > 0) {
      lastSpread.leftShowMore = true
    }
  }

  return spreads
}

function fillPanel(panelQuotes, allQuotes, startIndex, availableHeight, quoteHeights) {
  if (availableHeight <= 0) return startIndex

  let used = 0
  let i = startIndex

  while (i < allQuotes.length) {
    const quoteHeight = quoteHeights[i] ?? 0
    const gap = panelQuotes.length > 0 ? QUOTE_GAP : 0

    if (used + gap + quoteHeight > availableHeight) break

    panelQuotes.push(allQuotes[i])
    used += gap + quoteHeight
    i += 1
  }

  return i
}

/** Simple first-spread layout used until DOM measurement completes. */
export function buildFallbackSpreads(quotes) {
  const empty = {
    left: [],
    right: [],
    leftIsChapter: true,
    leftShowMore: false,
    rightShowMore: false,
  }

  if (!quotes.length) return [empty]

  const lastOnRight = quotes.length > 1

  return [
    {
      left: [quotes[0]],
      right: quotes.slice(1),
      leftIsChapter: true,
      leftShowMore: !lastOnRight,
      rightShowMore: lastOnRight,
    },
  ]
}
