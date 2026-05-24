import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SkeletonButton } from './Skeleton'
import { spring } from '../lib/motion'

export default function DiaryEntryModal({ open, onClose, onSave, entry, saving = false, error = '' }){
  const [text, setText] = useState('')

  useEffect(() => {
    setText(entry?.content || '')
  }, [entry, open])

  function handleSubmit(){
    onSave({ ...entry, content: text })
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="diary-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="diary-modal-title"
            initial={{ opacity: 0, y: 24, scale: 0.97, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(4px)' }}
            transition={spring.modal}
            className="diary-modal-card max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="eyebrow">{entry ? 'Edit reflection' : 'New reflection'}</p>
            <h3 id="diary-modal-title" className="mt-2 font-semibold text-2xl">
              {entry ? 'Edit entry' : 'New entry'}
            </h3>
            <p className="mt-2 subtle">Capture the moment honestly. You can revise it before saving.</p>

            <label className="mt-4 block">
              <span className="sr-only">Diary entry</span>
              <textarea
                className="diary-modal-textarea mt-1"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Today felt like..."
                rows={8}
                disabled={saving}
              />
            </label>

            {error ? (
              <p className="mt-3 text-sm text-[#e8a080]" role="alert">{error}</p>
            ) : null}

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="soft-button cursor-pointer"
                disabled={saving}
              >
                Cancel
              </button>
              {saving ? (
                <SkeletonButton className="h-11 w-28 shrink-0" />
              ) : (
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  className="soft-button soft-button-primary border-transparent cursor-pointer"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Save entry
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
