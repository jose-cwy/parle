import { useEffect, useMemo, useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import HavenPageTopbar from './HavenPageTopbar'
import HavenModal from './HavenModal'
import LockedEntryPanel from './LockedEntryPanel'
import { todayKey, isToday, isPastDate, isFutureDate } from '../../lib/haven/dates'
import { calendarDateKeyFromEntry } from '../../lib/journal'
import { journalClientHeaders } from '../../lib/journalClientDate'
import WallCalendar from './WallCalendar'
import { pulseWarmth } from '../../lib/warmthPulse'
import { useTopProgress } from '../../lib/hooks/useTopProgress'

const PRIVACY_KEY = 'hsc.journal.privacy.v1'
const PRIVACY_KEY_LEGACY = 'hsc.diary.privacy.v1'

function groupEntriesByDate(entries) {
  const map = new Map()
  entries.forEach((entry) => {
    const key = calendarDateKeyFromEntry(entry)
    if (!key) return
    const existing = map.get(key)
    if (!existing || Number(entry.id) > Number(existing.id)) {
      map.set(key, entry)
    }
  })
  return map
}

const MSG_PAST_LOCKED = "Past entries are kept as they were. You can only edit today's page."
const MSG_FUTURE = "Tomorrow's page will open when it arrives."

export default function HavenJournal() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [today, setToday] = useState('')
  const [draft, setDraft] = useState('')
  const [todayEntryId, setTodayEntryId] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [notice, setNotice] = useState('')

  async function fetchEntries() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/journal', {
        headers: journalClientHeaders(todayKey()),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to load journal entries.')
      }
      setEntries(await res.json())
    } catch (err) {
      setError(err.message || 'Unable to load journal entries.')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setToday(todayKey())
    try {
      const dismissed =
        localStorage.getItem(PRIVACY_KEY) || localStorage.getItem(PRIVACY_KEY_LEGACY)
      if (!dismissed) setShowPrivacy(true)
    } catch {
      /* ignore */
    }
    fetchEntries()
  }, [])

  useEffect(() => {
    const syncToday = () => {
      const next = todayKey()
      setToday((prev) => (prev === next ? prev : next))
    }
    const id = window.setInterval(syncToday, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncToday()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const entryMap = useMemo(() => groupEntriesByDate(entries), [entries])

  useTopProgress(loading)

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
      const currentToday = todayKey()
      const todayEntry = entryMap.get(currentToday)
      const entryId = todayEntry?.id ?? todayEntryId

      const saveHeaders = {
        'Content-Type': 'application/json',
        ...journalClientHeaders(currentToday),
      }

      let method = entryId ? 'PUT' : 'POST'
      let url = entryId ? `/api/journal/${entryId}` : '/api/journal'

      let res = await fetch(url, {
        method,
        headers: saveHeaders,
        body: JSON.stringify({ content: draft.trim() }),
      })
      let payload = await res.json().catch(() => ({}))

      if (res.status === 409 && payload.id) {
        method = 'PUT'
        url = `/api/journal/${payload.id}`
        setTodayEntryId(payload.id)
        res = await fetch(url, {
          method: 'PUT',
          headers: saveHeaders,
          body: JSON.stringify({ content: draft.trim() }),
        })
        payload = await res.json().catch(() => ({}))
      }

      if (!res.ok) throw new Error(payload.error || 'Unable to save your entry.')

      if (method === 'POST') {
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
    const entry = entryMap.get(dateKey)
    if (!entry) return
    setViewing({
      date: dateKey,
      body: entry.content,
    })
    setNotice('')
  }

  function handleCalendarSelect(dateKey) {
    const currentToday = todayKey()
    if (today !== currentToday) setToday(currentToday)

    setNotice('')
    setError('')

    if (isFutureDate(dateKey, currentToday)) {
      setViewing(null)
      setNotice(MSG_FUTURE)
      return
    }

    if (isToday(dateKey, currentToday)) {
      setViewing(null)
      const existing = entryMap.get(currentToday)
      setDraft(existing?.content ?? '')
      setTodayEntryId(existing?.id ?? null)
      return
    }

    if (isPastDate(dateKey, currentToday)) {
      if (entryMap.has(dateKey)) {
        openPastEntry(dateKey)
      } else {
        setViewing(null)
        setNotice(MSG_PAST_LOCKED)
      }
    }
  }

  if (loading) {
    return null
  }

  return (
    <div className="haven-journal space-y-7">
      <HavenPageTopbar label="Journal" />

      <header className="rise">
        <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Journal</p>
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

      {notice ? (
        <div className="paper p-4 text-sm text-muted-foreground" role="status">
          {notice}
        </div>
      ) : null}

      <div className="grid md:grid-cols-[1fr_1.05fr] gap-6 items-start">
        <div className="relative">
          <WallCalendar today={today} entryMap={entryMap} onSelect={handleCalendarSelect} />
          {viewing ? (
            <LockedEntryPanel
              dateKey={viewing.date}
              body={viewing.body}
              onClose={() => setViewing(null)}
            />
          ) : null}
        </div>

        <div className="paper rise rise-2 p-6 md:p-8 relative">
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

          <div className="mt-5 haven-journal-lines">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Start anywhere. A sentence is enough."
              className="haven-journal-lines__textarea"
              spellCheck
              aria-label="Today's journal entry"
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
              {saving ? 'Saving…' : savedFlash ? 'Kept' : 'Save today\u2019s entry'}
            </button>
          </div>
        </div>
      </div>

      {showPrivacy && (
        <HavenModal onClose={dismissPrivacy} small>
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-secondary grid place-items-center text-clay">
              <ShieldCheck size={20} strokeWidth={1.7} />
            </div>
            <div>
              <h3 className="font-serif text-xl text-foreground">
                Your journal is private. This space is for you only.
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
