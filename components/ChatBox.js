import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatSkeleton, SkeletonBlock, SkeletonButton } from './loading'
import { spring, hoverGlow } from '../lib/motion'
import { pulseWarmth } from '../lib/warmthPulse'

export default function ChatBox(){
  const [messages, setMessages] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef()

  const PROMPTS = [
    'I keep rereading our last messages.',
    'I miss them, and I hate it.',
    'I feel angry and embarrassed.',
  ]

  useEffect(()=>{
    fetch('/api/chat/history')
      .then(r=>r.ok ? r.json() : [])
      .then(d=> setMessages(d))
      .catch(()=> setMessages([]))
  },[])

  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  },[messages, loading])

  async function send(){
    if(!input || loading) return
    const userMsg = { role:'user', text: input }
    setMessages(prev=>[...(prev || []), userMsg])
    setInput('')
    setLoading(true)
    const res = await fetch('/api/chat/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:userMsg.text})})
    if(res.ok){
      const data = await res.json();
      setMessages(prev=>[...(prev || []), { role:'assistant', text: data.reply }])
      pulseWarmth(1, 1600)
      await fetch('/api/gamification/progress',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({deltaChat:1})
      })
    }
    else setMessages(prev=>[...(prev || []), { role:'assistant', text: 'Sorry, something went wrong.' }])
    setLoading(false)
  }

  if(messages === null) return <ChatSkeleton />

  const isEmpty = messages.length === 0 && !loading

  return (
    <motion.div
      className="chat-shell card p-3 flex flex-col h-[32rem]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.gentle, opacity: { duration: 0.45 } }}
    >
      <div className="mb-4 chat-shell-header flex items-center justify-between">
        <div>
          <p className="eyebrow">Heartstrings AI</p>
          <p className="mt-1 text-sm subtle">A quiet place to say what happened.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chat-status-dot inline-block w-2 h-2 rounded-full" aria-hidden="true" />
          <span className="chat-status-label">Here with you</span>
        </div>
      </div>
      <div className="chat-prompts" aria-label="Quick starters">
        {PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            className="chat-prompt-chip"
            disabled={loading}
            onClick={() => setInput(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-3 space-y-3 pr-1">
        {isEmpty ? (
          <p className="chat-empty">Start with one sentence. I&apos;m here.</p>
        ) : null}
        <AnimatePresence initial={false}>
          {messages.map((m,i)=> (
            <motion.div
              key={`${m.role}-${i}-${m.text.slice(0, 12)}`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={spring.gentle}
              layout
              className={`chat-bubble ${m.role==='user' ? 'chat-bubble-user ml-auto' : 'chat-bubble-assistant'}`}
              style={{maxWidth:'80%'}}
            >
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="chat-bubble chat-bubble-assistant w-[72%] space-y-2 p-4"
          >
            <SkeletonBlock className="h-3 w-full" rounded="rounded-full" />
            <SkeletonBlock className="h-3 w-[88%]" rounded="rounded-full" />
            <SkeletonBlock className="h-3 w-[64%]" rounded="rounded-full" />
          </motion.div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          className="input-field flex-1 !mt-0"
          placeholder="Say what happened…"
          disabled={loading}
          aria-label="Message"
          onKeyDown={(e) => {
            if(e.key === 'Enter' && !e.shiftKey){
              e.preventDefault()
              send()
            }
          }}
        />
        {loading ? (
          <SkeletonButton className="h-12 w-24 shrink-0" />
        ) : (
          <motion.button
            type="button"
            onClick={send}
            className="soft-button soft-button-primary border-transparent px-4"
            {...hoverGlow}
          >
            Send
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}
