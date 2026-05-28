import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QuotesSkeleton } from './loading'
import { spring, hoverLift } from '../lib/motion'

export default function QuotesBook(){
  const [chapters, setChapters] = useState(null)
  const [active, setActive] = useState('')
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=>{
    setLoading(true)
    setError('')
    Promise.all([
      fetch('/api/quotes').then((r) => {
        if(!r.ok) throw new Error('Unable to load quotes.')
        return r.json()
      }),
      fetch('/api/quotes/favorites').then(r=>r.ok ? r.json() : [])
    ]).then(([data, favs]) => {
      setChapters(data)
      setActive(Object.keys(data)[0] || '')
      setFavorites(favs || [])
    }).catch((err) => {
      setError(err.message || 'Unable to load quotes.')
      setChapters({})
    }).finally(() => setLoading(false))
  },[])

  async function toggleFav(id){
    const has = favorites.includes(id)
    setFavorites(prev => has ? prev.filter(x=>x!==id) : [...prev,id])
    await fetch('/api/quotes/favorites',{
      method: has ? 'DELETE' : 'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ quoteId:id })
    })
  }

  async function markRead(){
    await fetch('/api/quotes/read',{method:'POST'})
  }

  if(loading) return <QuotesSkeleton />

  if(error){
    return (
      <div className="hs-app-card p-8 text-center" role="alert">
        <p className="font-semibold text-lg">Quotes could not load</p>
        <p className="mt-2 subtle">{error}</p>
      </div>
    )
  }

  if(!Object.keys(chapters).length){
    return (
      <div className="hs-app-card p-8 text-center">
        <p className="font-semibold text-lg">No quotes yet</p>
        <p className="mt-2 subtle">Check back soon for new chapters to browse.</p>
      </div>
    )
  }

  return (
    <div className="quotes-layout">
      <nav className="hs-app-card quotes-sidebar">
        <p className="eyebrow">Chapters</p>
        <h3 className="mt-2">Browse by mood</h3>
        {Object.keys(chapters).map(c=> (
          <motion.button
            key={c}
            type="button"
            onClick={()=>setActive(c)}
            {...hoverLift}
            className={`chapter-button ${c===active ? 'chapter-button-active' : ''}`}
          >
            {c}
          </motion.button>
        ))}
      </nav>
      <div className="quotes-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="hs-app-card quotes-main-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={spring.gentle}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="eyebrow">Current chapter</p>
                <h3 className="mt-1 font-semibold">{active}</h3>
              </div>
              <div className="quotes-count-badge">
                {(chapters[active] || []).length} quotes
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              {(chapters[active]||[]).map((q, index)=> (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, ...spring.gentle }}
                  className="quote-row"
                >
                  <button type="button" onClick={markRead} className="quote-copy text-left flex-1">{q.text}</button>
                  <motion.button
                    type="button"
                    onClick={()=>toggleFav(q.id)}
                    className={`favorite-pill ${favorites.includes(q.id) ? 'favorite-pill-active' : ''}`}
                    {...hoverLift}
                  >
                    {favorites.includes(q.id) ? 'Saved' : 'Save'}
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
