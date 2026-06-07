import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import HavenModal from './HavenModal'

function useParleSettings() {
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    fetch('/api/chat/context')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setMemoryEnabled(Boolean(data.memory_enabled))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggleMemory() {
    const next = !memoryEnabled
    setSaving(true)
    setStatus('')
    try {
      const res = await fetch('/api/chat/context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memory_enabled: next }),
      })
      if (res.ok) {
        setMemoryEnabled(next)
        setStatus(next ? 'Memory turned on.' : 'Memory turned off.')
      } else {
        setStatus('Could not update right now.')
      }
    } catch {
      setStatus('Could not update right now.')
    } finally {
      setSaving(false)
    }
  }

  async function resetPreferences() {
    setResetting(true)
    setStatus('')
    try {
      const res = await fetch('/api/user/parle-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-preferences' }),
      })
      if (res.ok) {
        setStatus('Preferences reset.')
        setConfirmReset(false)
      } else {
        setStatus('Could not reset right now.')
      }
    } catch {
      setStatus('Could not reset right now.')
    } finally {
      setResetting(false)
    }
  }

  return {
    memoryEnabled,
    loading,
    saving,
    confirmReset,
    setConfirmReset,
    resetting,
    status,
    toggleMemory,
    resetPreferences,
  }
}

export function ParleSettingsPanel({ compact = false, isAuthed = true }) {
  const {
    memoryEnabled,
    loading,
    saving,
    confirmReset,
    setConfirmReset,
    resetting,
    status,
    toggleMemory,
    resetPreferences,
  } = useParleSettings()

  if (!isAuthed) {
    return (
      <div className={compact ? '' : 'mt-2'}>
        {!compact && (
          <>
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">parlé</p>
            <h2 className="mt-2 font-serif text-2xl text-foreground">Chat preferences</h2>
          </>
        )}
        <p className={cn('text-sm text-muted-foreground leading-relaxed', compact ? 'mt-0' : 'mt-6')}>
          Sign in to manage chat preferences and memory settings.
        </p>
        <Link
          href="/login"
          className="inline-block mt-4 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[13px] leading-9 hover:opacity-90 transition"
        >
          Log in
        </Link>
      </div>
    )
  }

  return (
    <>
      {!compact && (
        <>
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">parlé</p>
          <h2 className="mt-2 font-serif text-2xl text-foreground">Chat preferences</h2>
        </>
      )}

      <div className={cn('flex items-start justify-between gap-4', compact ? 'mt-0' : 'mt-6')}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Remember my conversations</p>
          <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
            When on, parlé picks up where you left off next time you start a chat.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={memoryEnabled}
          aria-label="Remember my conversations"
          disabled={loading || saving}
          onClick={toggleMemory}
          className={cn(
            'relative shrink-0 h-7 w-12 rounded-full transition-colors duration-200',
            memoryEnabled ? 'bg-clay' : 'bg-border',
            (loading || saving) && 'opacity-50',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-card shadow transition-transform duration-200',
              memoryEnabled && 'translate-x-5',
            )}
          />
        </button>
      </div>

      <div className={cn('border-t border-border/70', compact ? 'mt-5 pt-4' : 'mt-6 pt-5')}>
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-[13px] text-muted-foreground hover:text-foreground transition"
          >
            Reset my preferences
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              This will reset what parlé has learned about you. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetPreferences}
                disabled={resetting}
                className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="h-8 px-3.5 rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
    </>
  )
}

export default function ParleSettings() {
  return (
    <section className="rise rise-5 paper p-6 md:p-8">
      <ParleSettingsPanel />
    </section>
  )
}

export function ParleSettingsPopup({ open, onClose, isAuthed }) {
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <HavenModal onClose={onClose} small>
      <div className="parle-settings-popup">
        <div className="parle-settings-popup__header">
          <h2 id="parle-settings-title" className="font-serif text-xl text-foreground">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="parle-settings-popup__close"
            aria-label="Close settings"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="parle-settings-popup__body">
          <ParleSettingsPanel compact isAuthed={isAuthed} />
        </div>
      </div>
    </HavenModal>
  )
}
