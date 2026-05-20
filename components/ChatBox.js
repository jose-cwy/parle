import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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
    <div className="chat-shell card p-3 flex flex-col h-[32rem]">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-[rgba(140,97,71,0.12)] bg-white/55 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Heartstrings AI</p>
          <p className="mt-1 text-sm subtle">Steady, supportive conversation when you need somewhere to start.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#7a6756]">
          <span className="status-dot" />
          Online
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-3 space-y-3 pr-1">
        <AnimatePresence initial={false}>
          {messages.map((m,i)=> (
            <motion.div
              key={`${m.role}-${i}-${m.text.slice(0, 12)}`}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`chat-bubble ${m.role==='user' ? 'chat-bubble-user ml-auto' : 'chat-bubble-assistant'}`}
              style={{maxWidth:'80%'}}
            >
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="chat-bubble chat-bubble-assistant inline-flex items-center gap-2"
          >
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </motion.div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          className="flex-1 rounded-2xl border border-[rgba(140,97,71,0.14)] bg-white/80 p-3 outline-none transition focus:border-[#b88957]"
          placeholder="Say how you feel..."
          onKeyDown={(e) => {
            if(e.key === 'Enter' && !e.shiftKey){
              e.preventDefault()
              send()
            }
          }}
        />
        <button onClick={send} disabled={loading} className="soft-button border-transparent bg-[#b79362] px-4 text-white">
          {loading ? 'Sending' : 'Send'}
        </button>
      </div>
    </div>
  )
}
