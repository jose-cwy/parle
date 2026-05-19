import { useEffect, useState } from 'react'
import DiaryEntryModal from '../components/DiaryEntryModal'
import CalendarView from '../components/CalendarView'
import RequireAuth from '../components/RequireAuth'

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
    setOpen(false); fetchEntries()
  }

  async function handleDelete(id){
    if(!confirm('Delete entry?')) return
    await fetch(`/api/diary/${id}`,{method:'DELETE'})
    fetchEntries()
  }

  return (
    <RequireAuth>
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Private Diary</h2>
          <button onClick={()=>{setEditing(null); setOpen(true)}} style={{background:'#b79362',color:'#fff'}} className="px-3 py-2 rounded">New</button>
        </div>
        <div className="space-y-3">
          {entries.map(e=> (
            <div key={e.id} className="card p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm subtle">{new Date(e.created_at).toLocaleString()}</div>
                  <div className="mt-2">{e.content.slice(0,200)}</div>
                </div>
                <div className="ml-4 flex flex-col gap-2">
                  <button onClick={()=>{setEditing(e); setOpen(true)}} className="subtle">Edit</button>
                  <button onClick={()=>handleDelete(e.id)} className="subtle">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside>
        <CalendarView year={new Date().getFullYear()} month={new Date().getMonth()} entriesByDate={entriesByDate()} onSelectDate={d=>setSelectedDate(d)} />
        <div className="mt-4 card p-3">
          <h4 className="font-semibold">Selected date</h4>
          <div className="subtle">{selectedDate || 'None'}</div>
        </div>
        <div className="mt-4 card p-3">
          <h4 className="font-semibold">Milestones</h4>
          <GamificationPanel />
        </div>
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
      <div className="mt-2 flex flex-wrap gap-2">
        {badges.length ? badges.map(b=> <span key={b} className="px-2 py-1 rounded bg-beige-100">{b}</span>) : <span className="subtle">No badges yet</span>}
      </div>
    </div>
  )
}
