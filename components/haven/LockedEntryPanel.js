import { useEffect } from 'react'
import { Lock, X } from 'lucide-react'

export default function LockedEntryPanel({ dateKey, body, onClose }) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const formattedDate = new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      className="haven-locked-entry absolute inset-0 z-10 flex flex-col rounded-[inherit] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Locked entry for ${formattedDate}`}
    >
      <div className="haven-locked-entry__surface flex-1 overflow-y-auto p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-clay flex items-center gap-2">
              <Lock size={11} strokeWidth={2} /> Locked entry
            </p>
            <h3 className="font-serif text-2xl mt-1 text-foreground">{formattedDate}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 shrink-0 grid place-items-center rounded-full hover:bg-secondary text-muted-foreground"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-5 text-[15px] leading-7 text-foreground whitespace-pre-wrap">{body}</p>
      </div>
    </div>
  )
}
