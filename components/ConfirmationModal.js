import { AnimatePresence, motion } from 'framer-motion'

export default function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel = 'Close',
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'primary',
  busy = false
}){
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,14,10,0.45)] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="card w-full max-w-md p-6"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-xs uppercase tracking-[0.18em] text-[#8c6147]">Heartstrings Club</p>
            <h3 className="mt-2 text-2xl font-semibold text-[#241e1a]">{title}</h3>
            <p className="mt-3 leading-7 subtle">{description}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              {cancelLabel ? (
                <button type="button" onClick={onCancel} className="soft-button" disabled={busy}>
                  {cancelLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={`soft-button border-transparent ${
                  confirmVariant === 'danger' ? 'bg-[#8c6147] text-white' : 'bg-[#b88957] text-white'
                }`}
              >
                {busy ? 'Please wait...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
