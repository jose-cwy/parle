import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SkeletonQuotesBook } from './Skeleton'
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

  if(loading) return <SkeletonQuotesBook />

  if(error){
    return (
      <div className="card diary-empty-state p-8 text-center" role="alert">
        <p className="text-lg font-semibold">Quotes could not load</p>
        <p className="mt-2 subtle">{error}</p>
      </div>
    )
  }

  if(!Object.keys(chapters).length){
    return (
      <div className="card diary-empty-state p-8 text-center">
        <p className="text-lg font-semibold">No quotes yet</p>
        <p className="mt-2 subtle">Check back soon for new chapters to browse.</p>
      </div>
    )
  }

  return (
    <div className="grid md:grid-cols-4 gap-6">
      <nav className="md:col-span-1 card p-3">
        <p className="eyebrow">Chapters</p>
        <h3 className="mt-2 text-xl font-semibold">Browse by mood</h3>
        {Object.keys(chapters).map(c=> (
          <motion.button
            key={c}
            onClick={()=>setActive(c)}
            {...hoverLift}
            className={`chapter-button ${c===active ? 'chapter-button-active' : ''}`}
          >
            {c}
          </motion.button>
        ))}
      </nav>
      <div className="md:col-span-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            className="card p-4"
            initial={{ opacity: 0, y: 18, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={spring.gentle}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Current chapter</p>
                <h3 className="mt-1 font-semibold text-2xl">{active}</h3>
              </div>
              <div className="rounded-full border border-[var(--border)] bg-[rgba(34,28,44,0.65)] px-3 py-1 text-sm text-[var(--muted)]">
                {(chapters[active] || []).length} quotes
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {(chapters[active]||[]).map((q, index)=> (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.035, ...spring.gentle }}
                  className="quote-row"
                >
                  <button onClick={markRead} className="quote-copy text-left">{q.text}</button>
                  <motion.button
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
