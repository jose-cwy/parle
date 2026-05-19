import { useState, useEffect, useRef } from 'react'

export default function ChatBox(){
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef()

  useEffect(()=>{ fetch('/api/chat/history').then(r=>r.ok && r.json().then(d=>setMessages(d))) },[])

  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight },[messages])

  async function send(){
    if(!input) return
    const userMsg = { role:'user', text: input }
    setMessages(prev=>[...prev, userMsg])
    setInput('')
    setLoading(true)
    const res = await fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:userMsg.text})})
    if(res.ok){
      const data = await res.json();
      setMessages(prev=>[...prev, { role:'assistant', text: data.reply }])
      await fetch('/api/gamification/progress',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({deltaChat:1})
      })
    }
    else setMessages(prev=>[...prev, { role:'assistant', text: 'Sorry, something went wrong.' }])
    setLoading(false)
  }

  return (
    <div className="card p-3 flex flex-col h-96">
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-3 space-y-3">
        {messages.map((m,i)=> (
          <div key={i} className={`p-2 rounded ${m.role==='user' ? 'bg-white self-end':'bg-beige-50'}`} style={{maxWidth:'80%'}}>{m.text}</div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} className="flex-1 p-2 rounded" placeholder="Say how you feel..." />
        <button onClick={send} disabled={loading} style={{background:'#b79362',color:'#fff'}} className="px-3 rounded">Send</button>
      </div>
    </div>
  )
}
