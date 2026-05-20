import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function QuotesBook(){
  const [chapters, setChapters] = useState({})
  const [active, setActive] = useState('Heartbreak')
  const [favorites, setFavorites] = useState([])

  useEffect(()=>{
    fetch('/api/quotes').then(r=>r.json()).then(d=>{ setChapters(d); setActive(Object.keys(d)[0]) })
    fetch('/api/quotes/favorites').then(r=>r.ok && r.json().then(setFavorites))
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

  return (
    <div className="grid md:grid-cols-4 gap-6">
      <nav className="md:col-span-1 card p-3">
        <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Chapters</p>
        <h3 className="mt-2 text-xl font-semibold text-[#241e1a]">Browse by mood</h3>
        {Object.keys(chapters).map(c=> (
          <motion.button
            key={c}
            onClick={()=>setActive(c)}
            whileHover={{ x: 6 }}
            whileTap={{ scale: 0.98 }}
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
            exit={{ opacity: 0, y: -12, scale: 0.99 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Current chapter</p>
                <h3 className="mt-1 font-semibold text-2xl">{active}</h3>
              </div>
              <div className="rounded-full bg-white/75 px-3 py-1 text-sm text-[#7a6756] shadow-sm">
                {(chapters[active] || []).length} quotes
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {(chapters[active]||[]).map((q, index)=> (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.28 }}
                  className="quote-row"
                >
                  <button onClick={markRead} className="quote-copy text-left">{q.text}</button>
                  <button onClick={()=>toggleFav(q.id)} className={`favorite-pill ${favorites.includes(q.id) ? 'favorite-pill-active' : ''}`}>
                    {favorites.includes(q.id) ? 'Saved' : 'Save'}
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
