import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function DiaryEntryModal({ open, onClose, onSave, entry }){
  const [text,setText] = useState('')

  useEffect(()=>{
    setText(entry?.content || '')
  },[entry])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{background:'rgba(10,10,10,0.3)'}}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-lg w-full card p-6"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">{entry ? 'Edit reflection' : 'New reflection'}</p>
            <h3 className="mt-2 font-semibold text-2xl">{entry? 'Edit Entry':'New Entry'}</h3>
            <p className="mt-2 subtle">Capture the moment honestly. You can revise it before saving.</p>
            <textarea
              className="mt-4 h-40 w-full rounded-2xl border border-[rgba(140,97,71,0.14)] bg-white/80 p-3 outline-none transition focus:border-[#b88957]"
              value={text}
              onChange={e=>setText(e.target.value)}
            />
            <div className="mt-3 flex gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-2 subtle">Cancel</button>
              <button onClick={()=>onSave({...entry, content:text})} className="soft-button border-transparent bg-[#b79362] px-4 py-2 text-white">Save</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
