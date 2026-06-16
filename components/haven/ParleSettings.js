import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Moon, Sun, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import {
  DEFAULT_SETTINGS_CACHE,
  readSettingsCache,
  writeSettingsCache,
} from '../../lib/parle/settingsCache'
import { THEMES } from '../../lib/theme'
import { useTheme } from '../ThemeProvider'
import HavenModal from './HavenModal'

function AppearanceToggle({ compact }) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={cn('flex items-start justify-between gap-4', compact ? 'mt-0' : 'mt-6')}>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-foreground">Appearance</p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          Choose light or dark mode for the interface.
        </p>
      </div>
      <div
        className="flex shrink-0 rounded-full border border-border bg-muted p-0.5"
        role="group"
        aria-label="Appearance"
      >
        <button
          type="button"
          onClick={() => setTheme(THEMES.LIGHT)}
          aria-pressed={theme === THEMES.LIGHT}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[10px] font-medium transition',
            theme === THEMES.LIGHT
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Sun size={14} strokeWidth={1.75} aria-hidden />
          Light
        </button>
        <button
          type="button"
          onClick={() => setTheme(THEMES.DARK)}
          aria-pressed={theme === THEMES.DARK}
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[10px] font-medium transition',
            theme === THEMES.DARK
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Moon size={14} strokeWidth={1.75} aria-hidden />
          Dark
        </button>
      </div>
    </div>
  )
}

function PrivacyToggle({ label, description, checked, disabled, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/70 mt-5 pt-4 first:mt-0 first:pt-0 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-foreground">{label}</p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          'relative shrink-0 h-7 w-12 rounded-full transition-colors duration-200',
          checked ? 'bg-clay' : 'bg-border',
          disabled && 'opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-card shadow transition-transform duration-200',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}

function PrivacyToggleSkeleton() {
  return (
    <div
      className="flex items-start justify-between gap-4 border-t border-border/70 mt-5 pt-4 first:mt-0 first:pt-0 first:border-t-0"
      aria-hidden
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-36 max-w-full rounded bg-border/70 animate-pulse" />
        <div className="h-2 w-full rounded bg-border/50 animate-pulse" />
        <div className="h-2 w-[88%] rounded bg-border/50 animate-pulse" />
      </div>
      <div className="h-7 w-12 shrink-0 rounded-full bg-border/70 animate-pulse" />
    </div>
  )
}

function applySettings(setters, settings) {
  setters.setMemoryEnabled(Boolean(settings.memory_enabled))
  setters.setPersonalisationEnabled(Boolean(settings.personalisation_enabled))
}

export function useParleSettings(isAuthed = true) {
  const cached = readSettingsCache()
  const [memoryEnabled, setMemoryEnabled] = useState(
    () => cached?.memory_enabled ?? DEFAULT_SETTINGS_CACHE.memory_enabled,
  )
  const [personalisationEnabled, setPersonalisationEnabled] = useState(
    () => cached?.personalisation_enabled ?? DEFAULT_SETTINGS_CACHE.personalisation_enabled,
  )
  const [hydrating, setHydrating] = useState(() => isAuthed && !cached)
  const [hasCache, setHasCache] = useState(() => Boolean(cached))
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [status, setStatus] = useState('')
  const [statusVisible, setStatusVisible] = useState(false)
  const statusTimerRef = useRef(null)
  const fetchAbortRef = useRef(null)

  const setters = {
    setMemoryEnabled,
    setPersonalisationEnabled,
  }

  function showStatus(message) {
    setStatus(message)
    setStatusVisible(true)
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    statusTimerRef.current = setTimeout(() => {
      setStatusVisible(false)
      statusTimerRef.current = setTimeout(() => setStatus(''), 300)
    }, 2200)
  }

  const syncFromServer = useCallback(async () => {
    if (!isAuthed) {
      setHydrating(false)
      return null
    }

    if (fetchAbortRef.current) fetchAbortRef.current.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller

    try {
      const res = await fetch('/api/user/settings', { signal: controller.signal })
      if (!res.ok) return null
      const data = await res.json()
      if (!data || controller.signal.aborted) return null

      applySettings(setters, data)
      writeSettingsCache(data)
      setHasCache(true)
      return data
    } catch (error) {
      if (error?.name === 'AbortError') return null
      return null
    } finally {
      if (!controller.signal.aborted) {
        setHydrating(false)
      }
    }
  }, [isAuthed])

  useEffect(() => {
    if (!isAuthed) {
      setHydrating(false)
      return undefined
    }

    const cachedOnMount = readSettingsCache()
    if (cachedOnMount) {
      applySettings(setters, cachedOnMount)
      setHasCache(true)
      setHydrating(false)
    } else {
      setHydrating(true)
    }

    void syncFromServer()

    return () => {
      if (fetchAbortRef.current) fetchAbortRef.current.abort()
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    }
  }, [isAuthed, syncFromServer])

  async function patchSetting(field, next, successMessage, revert) {
    setStatus('')
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      })

      if (!res.ok) {
        revert()
        showStatus("couldn't save, try again")
        return false
      }

      const data = await res.json()
      applySettings(setters, data)
      writeSettingsCache(data)

      if (process.env.NODE_ENV === 'development') {
        console.log(`[parle settings] saved ${field}: ${next}`)
      }

      showStatus(successMessage)
      return true
    } catch {
      revert()
      showStatus("couldn't save, try again")
      return false
    }
  }

  async function toggleMemory() {
    const prev = memoryEnabled
    const next = !prev
    setMemoryEnabled(next)
    await patchSetting(
      'memory_enabled',
      next,
      next ? 'Conversation memory turned on.' : 'Conversation memory turned off.',
      () => setMemoryEnabled(prev),
    )
  }

  async function togglePersonalisation() {
    const prev = personalisationEnabled
    const next = !prev
    setPersonalisationEnabled(next)
    await patchSetting(
      'personalisation_enabled',
      next,
      next ? 'Personalisation turned on.' : 'Personalisation turned off.',
      () => setPersonalisationEnabled(prev),
    )
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
        showStatus('Preferences reset.')
        setConfirmReset(false)
      } else {
        showStatus("couldn't save, try again")
      }
    } catch {
      showStatus("couldn't save, try again")
    } finally {
      setResetting(false)
    }
  }

  return {
    memoryEnabled,
    personalisationEnabled,
    hydrating,
    hasCache,
    togglesReady: hasCache || !hydrating,
    confirmReset,
    setConfirmReset,
    resetting,
    status,
    statusVisible,
    toggleMemory,
    togglePersonalisation,
    resetPreferences,
    refreshSettings: syncFromServer,
  }
}

export function ParleSettingsPanel({
  compact = false,
  isAuthed = true,
  settings: settingsProp,
}) {
  const internalSettings = useParleSettings(isAuthed && !settingsProp)
  const settings = settingsProp || internalSettings
  const {
    memoryEnabled,
    personalisationEnabled,
    hydrating,
    togglesReady,
    confirmReset,
    setConfirmReset,
    resetting,
    status,
    statusVisible,
    toggleMemory,
    togglePersonalisation,
    resetPreferences,
  } = settings

  const showSkeleton = hydrating && !togglesReady

  if (!isAuthed) {
    return (
      <div className={compact ? '' : 'mt-2'}>
        {!compact && (
          <>
            <p className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">parlé</p>
            <h2 className="mt-2 font-serif text-[22px] text-foreground">Chat preferences</h2>
          </>
        )}
        <AppearanceToggle compact={compact} />
        <p className={cn('text-[12px] text-muted-foreground leading-relaxed', compact ? 'mt-5' : 'mt-6')}>
          Sign in to manage chat preferences and memory settings.
        </p>
        <Link
          href="/login"
          className="inline-block mt-4 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[11px] leading-9 hover:opacity-90 transition"
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
          <p className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">parlé</p>
          <h2 className="mt-2 font-serif text-[22px] text-foreground">Chat preferences</h2>
        </>
      )}

      <AppearanceToggle compact={compact} />

      <div className={cn(compact ? 'mt-5' : 'mt-6')}>
        {showSkeleton ? (
          <>
            <PrivacyToggleSkeleton />
            <PrivacyToggleSkeleton />
          </>
        ) : (
          <>
            <PrivacyToggle
              label="Remember my conversations"
              description="parlé will remember what you talked about last time and open with a personalised message when you return. Only you can see this. Off by default."
              checked={memoryEnabled}
              disabled={!togglesReady}
              onToggle={toggleMemory}
            />
            <PrivacyToggle
              label="Personalise my experience"
              description="parlé learns your preferences over time — like whether you prefer shorter responses or a warmer tone. This data never leaves parlé and is never shared. Off by default."
              checked={personalisationEnabled}
              disabled={!togglesReady}
              onToggle={togglePersonalisation}
            />
          </>
        )}
      </div>

      <div className={cn('border-t border-border/70', compact ? 'mt-5 pt-4' : 'mt-6 pt-5')}>
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition"
          >
            Reset my preferences
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This will reset what parlé has learned about you. Are you sure?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetPreferences}
                disabled={resetting}
                className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-[11px] hover:opacity-90 disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="h-8 px-3.5 rounded-lg border border-border text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {status ? (
        <p
          className={cn(
            'mt-3 text-[10px] text-muted-foreground parle-settings-status',
            statusVisible ? 'parle-settings-status--visible' : 'parle-settings-status--hidden',
          )}
        >
          {status}
        </p>
      ) : null}
    </>
  )
}

export function ParleSettingsPopup({ open, onClose, isAuthed }) {
  const settings = useParleSettings(isAuthed)
  const refreshRef = useRef(settings.refreshSettings)
  refreshRef.current = settings.refreshSettings

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (open && isAuthed) {
      void refreshRef.current()
    }
  }, [open, isAuthed])

  if (!open) return null

  return (
    <HavenModal onClose={onClose} small>
      <div className="parle-settings-popup">
        <div className="parle-settings-popup__header">
          <h2 id="parle-settings-title" className="font-serif text-[18px] text-foreground">
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
          <ParleSettingsPanel compact isAuthed={isAuthed} settings={settings} />
        </div>
      </div>
    </HavenModal>
  )
}
