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
          className="fixed inset-0 flex items-center justify-center"
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
            transition={{ duration: 0.25 }}
            className="max-w-lg w-full card p-6"
          >
            <h3 className="font-semibold mb-2">{entry? 'Edit Entry':'New Entry'}</h3>
            <textarea className="w-full p-3 rounded h-40" value={text} onChange={e=>setText(e.target.value)} />
            <div className="mt-3 flex gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-2 subtle">Cancel</button>
              <button onClick={()=>onSave({...entry, content:text})} className="px-3 py-2" style={{background:'#b79362',color:'#fff'}}>Save</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
