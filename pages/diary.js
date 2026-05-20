import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import DiaryEntryModal from '../components/DiaryEntryModal'
import CalendarView from '../components/CalendarView'
import RequireAuth from '../components/RequireAuth'
import Reveal from '../components/Reveal'

export default function Diary(){
  const [entries, setEntries] = useState([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(()=>{ fetchEntries() },[])

  async function fetchEntries(){
    const res = await fetch('/api/diary')
    if(res.ok){ setEntries(await res.json()) }
  }

  function entriesByDate(){
    const map = {}
    entries.forEach(e=>{ const d = e.created_at.slice(0,10); (map[d] = map[d]||[]).push(e) })
    return map
  }

  async function handleSave(e){
    const method = e.id ? 'PUT' : 'POST'
    const url = e.id ? `/api/diary/${e.id}` : '/api/diary'
    await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(e)})
    if(!e.id){
      await fetch('/api/gamification/progress',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({deltaEntries:1})
      })
    }
    setOpen(false)
    fetchEntries()
  }

  async function handleDelete(id){
    if(!confirm('Delete entry?')) return
    await fetch(`/api/diary/${id}`,{method:'DELETE'})
    fetchEntries()
  }

  return (
    <RequireAuth>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Reveal>
            <div className="flex flex-col gap-4 rounded-[28px] border border-[rgba(140,97,71,0.14)] bg-[rgba(255,251,246,0.72)] p-6 shadow-[0_24px_80px_rgba(40,28,18,0.08)] md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Private diary</p>
                <h2 className="mt-2 section-title text-[#241e1a]">Capture what today felt like.</h2>
                <p className="mt-3 max-w-2xl subtle">Your reflections now arrive with softer motion, cleaner hierarchy, and more presence around each saved moment.</p>
              </div>
              <button onClick={()=>{setEditing(null); setOpen(true)}} className="soft-button border-transparent bg-[#b79362] text-white">New entry</button>
            </div>
          </Reveal>
          <div className="space-y-3">
            {entries.map((e, index)=> (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.35 }}
                className="card diary-entry-card p-4"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="text-sm subtle">{new Date(e.created_at).toLocaleString()}</div>
                    <div className="mt-3 leading-7">{e.content.slice(0,200)}</div>
                  </div>
                  <div className="ml-4 flex flex-col gap-2">
                    <button onClick={()=>{setEditing(e); setOpen(true)}} className="subtle">Edit</button>
                    <button onClick={()=>handleDelete(e.id)} className="subtle">Delete</button>
                  </div>
                </div>
              </motion.div>
            ))}
            {!entries.length ? (
              <Reveal>
                <div className="card p-6 text-center">
                  <p className="text-lg font-semibold text-[#241e1a]">No entries yet</p>
                  <p className="mt-2 subtle">Start with a single honest sentence and let the space build around you.</p>
                </div>
              </Reveal>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <Reveal delay={0.08}>
            <CalendarView year={new Date().getFullYear()} month={new Date().getMonth()} entriesByDate={entriesByDate()} onSelectDate={d=>setSelectedDate(d)} />
          </Reveal>
          <Reveal delay={0.12}>
            <div className="card p-4">
              <h4 className="font-semibold text-lg">Selected date</h4>
              <div className="mt-2 subtle">{selectedDate || 'None'}</div>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="card p-4">
              <h4 className="font-semibold text-lg">Milestones</h4>
              <div className="mt-3">
                <GamificationPanel />
              </div>
            </div>
          </Reveal>
        </aside>

        <DiaryEntryModal open={open} onClose={()=>setOpen(false)} onSave={handleSave} entry={editing} />
      </div>
    </RequireAuth>
  )
}

function GamificationPanel(){
  const [progress,setProgress] = useState(null)
  useEffect(()=>{ fetch('/api/gamification/progress').then(r=>r.ok && r.json().then(setProgress)) },[])
  if(!progress) return <div className="subtle">Loading progress...</div>

  const badges = []
  if(progress.entries_count >= 3) badges.push('Journal Starter')
  if(progress.quotes_read >= 5) badges.push('Quote Explorer')
  if(progress.chat_interactions >= 5) badges.push('Heart Listener')

  return (
    <div className="space-y-2 text-sm">
      <div>Entries: <strong>{progress.entries_count}</strong></div>
      <div>Quotes Read: <strong>{progress.quotes_read}</strong></div>
      <div>Chat Interactions: <strong>{progress.chat_interactions}</strong></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {badges.length ? badges.map(b=> <span key={b} className="favorite-pill favorite-pill-active">{b}</span>) : <span className="subtle">No badges yet</span>}
      </div>
    </div>
  )
}
