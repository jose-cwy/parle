import { useState, useEffect } from 'react'

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
        {Object.keys(chapters).map(c=> (
          <button key={c} onClick={()=>setActive(c)} className={`w-full text-left py-2 ${c===active? 'font-semibold':''}`}>{c}</button>
        ))}
      </nav>
      <div className="md:col-span-3">
        <div className="card p-4">
          <h3 className="font-semibold">{active}</h3>
          <div className="mt-3 space-y-3">
            {(chapters[active]||[]).map(q=> (
              <div key={q.id} className="p-3 border rounded flex justify-between items-start">
                <button onClick={markRead} className="text-left">{q.text}</button>
                <button onClick={()=>toggleFav(q.id)} className="subtle">{favorites.includes(q.id)? '★':'☆'}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
