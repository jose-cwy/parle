import { useCallback, useEffect, useState } from 'react'

/**
 * Single saved quote backed by /api/quotes/favorites + /api/quotes.
 * Enforces one favorite in the UI (replaces previous on save).
 */
export function useSavedQuote() {
  const [saved, setSaved] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [quotesRes, favRes] = await Promise.all([
        fetch('/api/quotes'),
        fetch('/api/quotes/favorites'),
      ])
      if (!quotesRes.ok || !favRes.ok) {
        setSaved(null)
        return
      }
      const chapters = await quotesRes.json()
      const favIds = await favRes.json()
      const favId = Array.isArray(favIds) && favIds.length ? favIds[favIds.length - 1] : null
      if (!favId) {
        setSaved(null)
        return
      }
      for (const [chapter, quotes] of Object.entries(chapters)) {
        const q = (quotes || []).find((item) => item.id === favId)
        if (q) {
          setSaved({
            id: q.id,
            text: q.text,
            author: q.author || 'Unknown',
            chapter,
          })
          return
        }
      }
      setSaved(null)
    } catch {
      setSaved(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveQuote = useCallback(
    async (quote, chapter) => {
      if (!quote?.id) return
      try {
        const favRes = await fetch('/api/quotes/favorites')
        const existing = favRes.ok ? await favRes.json() : []
        await Promise.all(
          (existing || [])
            .filter((id) => id !== quote.id)
            .map((id) =>
              fetch('/api/quotes/favorites', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quoteId: id }),
              }),
            ),
        )
        const has = (existing || []).includes(quote.id)
        if (!has) {
          await fetch('/api/quotes/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quoteId: quote.id }),
          })
        }
        setSaved({
          id: quote.id,
          text: quote.text,
          author: quote.author || 'Unknown',
          chapter,
        })
      } catch {
        /* keep prior state */
      }
    },
    [],
  )

  const clearQuote = useCallback(async () => {
    if (!saved?.id) {
      setSaved(null)
      return
    }
    try {
      await fetch('/api/quotes/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: saved.id }),
      })
      setSaved(null)
    } catch {
      /* ignore */
    }
  }, [saved])

  const toggleQuote = useCallback(
    async (quote, chapter) => {
      if (saved?.id === quote.id) {
        await clearQuote()
      } else {
        await saveQuote(quote, chapter)
      }
    },
    [saved, saveQuote, clearQuote],
  )

  return { saved, loading, reload: load, saveQuote, clearQuote, toggleQuote }
}
