import { useEffect, useMemo, useState } from 'react'
import { Lock, X, Check, ShieldCheck } from 'lucide-react'
import { cn } from '../../lib/cn'
import HavenModal from './HavenModal'
import {
  todayKey,
  dateKeyOf,
  formatLocalDateKey,
  wordCount,
  intensityFor,
} from '../../lib/haven/dates'
import { pulseWarmth } from '../../lib/warmthPulse'

const PRIVACY_KEY = 'hsc.diary.privacy.v1'
const REFLECTION_PREFIX = 'hsc.diary.reflection.'

function loadReflection(dateKey) {
  try {
    const raw = localStorage.getItem(`${REFLECTION_PREFIX}${dateKey}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveReflection(dateKey, body) {
  try {
    localStorage.setItem(
      `${REFLECTION_PREFIX}${dateKey}`,
      JSON.stringify({ date: todayKey(), body }),
    )
  } catch {
    /* ignore */
  }
}

function groupEntriesByDate(entries) {
  const map = new Map()
  entries.forEach((entry) => {
    const key = formatLocalDateKey(entry.created_at)
    const existing = map.get(key)
    if (!existing || new Date(entry.created_at) > new Date(existing.created_at)) {
      map.set(key, entry)
    }
  })
  return map
}

function WallCalendar({ today, entryMap, onSelect }) {
  const ref = today ? new Date(`${today}T12:00:00`) : new Date()
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="rise rise-1 paper p-5 md:p-6 relative">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-rose/60 shadow-[0_0_0_3px_oklch(0.97_0.02_75)]" />
      <header className="flex items-end justify-between mt-2">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.26em] text-muted-foreground">Wall calendar</p>
          <h2 className="font-serif text-2xl text-foreground mt-0.5">{monthLabel}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">less</span>
          <span className="h-3 w-3 rounded-sm border border-border" />
          <span className="h-3 w-3 rounded-sm bg-[oklch(0.95_0.025_35)] border border-border/70" />
          <span className="h-3 w-3 rounded-sm bg-[oklch(0.9_0.045_30)] border border-border/70" />
          <span className="h-3 w-3 rounded-sm bg-[oklch(0.83_0.07_28)] border border-border/70" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">more</span>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-7 text-center text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/80">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} className="aspect-square" />
          const k = dateKeyOf(d)
          const isToday = k === today
          const isFuture = today && k > today
          const e = entryMap.get(k)
          const wc = e ? wordCount(e.content) : 0
          const lvl = intensityFor(wc)
          const clickable = !isFuture && (isToday || !!e)
          return (
            <button
              key={k}
              type="button"
              disabled={!clickable}
              onClick={() => onSelect(k)}
              className={cn(
                'relative aspect-square rounded-lg border text-[13px] flex items-start justify-end p-1.5 transition-all duration-300',
                isFuture
                  ? 'border-border/40 text-muted-foreground/40 bg-transparent'
                  : 'border-border/70 hover:border-clay/40',
                lvl === 1 && 'bg-[oklch(0.95_0.025_35)]',
                lvl === 2 && 'bg-[oklch(0.9_0.045_30)]',
                lvl === 3 && 'bg-[oklch(0.83_0.07_28)] text-foreground',
                isToday && 'ring-2 ring-clay ring-offset-2 ring-offset-card border-transparent',
              )}
              aria-label={`${k}${e ? ', entry' : ''}`}
            >
              <span className={cn('font-medium', isToday && 'text-clay')}>{d.getDate()}</span>
              {e && <span className="absolute bottom-1.5 left-1.5 h-1 w-1 rounded-full bg-rose" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function HavenDiary() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [today, setToday] = useState('')
  const [draft, setDraft] = useState('')
  const [todayEntryId, setTodayEntryId] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [reflectionDraft, setReflectionDraft] = useState('')
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  async function fetchEntries() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/diary')
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to load diary entries.')
      }
      setEntries(await res.json())
    } catch (err) {
      setError(err.message || 'Unable to load diary entries.')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setToday(todayKey())
    try {
      if (!localStorage.getItem(PRIVACY_KEY)) setShowPrivacy(true)
    } catch {
      /* ignore */
    }
    fetchEntries()
  }, [])

  const entryMap = useMemo(() => groupEntriesByDate(entries), [entries])

  useEffect(() => {
    if (!today) return
    const existing = entryMap.get(today)
    setDraft(existing?.content ?? '')
    setTodayEntryId(existing?.id ?? null)
  }, [today, entryMap])

  function dismissPrivacy() {
    try {
      localStorage.setItem(PRIVACY_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowPrivacy(false)
  }

  async function saveToday() {
    if (!draft.trim()) return
    setSaving(true)
    setError('')
    try {
      const method = todayEntryId ? 'PUT' : 'POST'
      const url = todayEntryId ? `/api/diary/${todayEntryId}` : '/api/diary'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft.trim() }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Unable to save your entry.')

      if (!todayEntryId) {
        await fetch('/api/gamification/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deltaEntries: 1 }),
        }).catch(() => null)
      }

      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1400)
      pulseWarmth(0.8, 1800)
      await fetchEntries()
    } catch (err) {
      setError(err.message || 'Unable to save your entry.')
    } finally {
      setSaving(false)
    }
  }

  function openPastEntry(dateKey) {
    if (dateKey === today) return
    const entry = entryMap.get(dateKey)
    if (!entry) return
    const reflection = loadReflection(dateKey)
    setViewing({
      date: dateKey,
      body: entry.content,
      reflection,
    })
    setReflectionDraft('')
  }

  function addReflection() {
    if (!viewing || !reflectionDraft.trim()) return
    const reflection = { date: todayKey(), body: reflectionDraft.trim() }
    saveReflection(viewing.date, reflection.body)
    setViewing({ ...viewing, reflection })
    setReflectionDraft('')
  }

  if (loading) {
    return (
      <div className="space-y-7">
        <div className="skeleton-soft h-10 w-64" />
        <div className="grid md:grid-cols-2 gap-6">
          <div className="skeleton-soft h-80" />
          <div className="skeleton-soft h-80" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <header className="rise">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Diary</p>
        <h1 className="mt-2 text-3xl md:text-4xl text-foreground">
          A page for today, <span className="italic text-clay">only today.</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground text-sm leading-relaxed">
          Yesterday is kept. Tomorrow waits. This is the page you can write on.
        </p>
      </header>

      {error ? (
        <div className="paper p-4 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid md:grid-cols-[1fr_1.05fr] gap-6 items-start">
        <WallCalendar today={today} entryMap={entryMap} onSelect={openPastEntry} />

        <div className="paper rise rise-2 p-6 md:p-8 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-clay">Today</p>
              <h2 className="font-serif text-2xl text-foreground mt-1">
                {today
                  ? new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '\u00A0'}
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground">{wordCount(draft)} words</span>
          </div>

          <div className="mt-5 relative">
            <div
              aria-hidden
              className="absolute inset-0 rounded-xl pointer-events-none opacity-60"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, oklch(0.9 0.02 70) 28px)',
              }}
            />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Start anywhere. A sentence is enough."
              className="relative w-full min-h-[280px] bg-transparent outline-none p-3 leading-7 text-[15px] text-foreground placeholder:text-muted-foreground/70 rounded-xl focus:ring-2 focus:ring-clay/20 transition"
            />
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[11px] text-muted-foreground">Private. Saved to your account.</p>
            <button
              type="button"
              onClick={saveToday}
              disabled={saving || !draft.trim()}
              className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50"
            >
              {savedFlash ? <Check size={15} /> : null}
              {saving ? 'Saving…' : savedFlash ? 'Kept' : 'Keep this page'}
            </button>
          </div>
        </div>
      </div>

      {viewing && (
        <HavenModal onClose={() => setViewing(null)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-clay flex items-center gap-2">
                <Lock size={11} strokeWidth={2} /> Locked entry
              </p>
              <h3 className="font-serif text-2xl mt-1">
                {new Date(`${viewing.date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="h-9 w-9 grid place-items-center rounded-full hover:bg-secondary text-muted-foreground"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mt-5 text-[15px] leading-7 text-foreground whitespace-pre-wrap">{viewing.body}</p>

          <div className="mt-7 pt-5 border-t border-dashed border-border">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground mb-3">
              A later reflection
            </p>
            {viewing.reflection ? (
              <div className="paper-note p-4">
                <p className="text-[15px] leading-7 text-foreground">{viewing.reflection.body}</p>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Reflected on{' '}
                  {new Date(`${viewing.reflection.date}T12:00:00`).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            ) : (
              <div>
                <textarea
                  value={reflectionDraft}
                  onChange={(e) => setReflectionDraft(e.target.value)}
                  rows={3}
                  placeholder="One sentence from today's you to that day's you…"
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-[14.5px] outline-none focus:border-clay/50 focus:ring-2 focus:ring-clay/15 resize-none"
                />
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Reflections are stored on this device only.
                </p>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={addReflection}
                    disabled={!reflectionDraft.trim()}
                    className="px-4 h-9 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-40 hover:opacity-90 transition"
                  >
                    Add reflection
                  </button>
                </div>
              </div>
            )}
          </div>
        </HavenModal>
      )}

      {showPrivacy && (
        <HavenModal onClose={dismissPrivacy} small>
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-secondary grid place-items-center text-clay">
              <ShieldCheck size={20} strokeWidth={1.7} />
            </div>
            <div>
              <h3 className="font-serif text-xl text-foreground">
                Your diary is private. This space is for you only.
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Nothing you write here is shared, scored, or sent anywhere. It&apos;s a quiet room
                meant for honesty — including the kind you can&apos;t say out loud yet.
              </p>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                You can only write on today&apos;s page. Past pages are kept as they were written.
              </p>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={dismissPrivacy}
                  className="px-5 h-10 rounded-xl bg-primary text-primary-foreground text-sm hover:opacity-90"
                >
                  I understand
                </button>
              </div>
            </div>
          </div>
        </HavenModal>
      )}
    </div>
  )
}
