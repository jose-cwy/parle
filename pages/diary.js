import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DiaryEntryModal from '../components/DiaryEntryModal'
import CalendarView from '../components/CalendarView'
import DiaryRoomHero from '../components/DiaryRoomHero'
import RequireAuth from '../components/RequireAuth'
import AppShell from '../components/AppShell'
import Reveal from '../components/Reveal'
import { DiarySkeleton, SkeletonText } from '../components/loading'
import { spring, hoverGlow } from '../lib/motion'
import { pulseWarmth } from '../lib/warmthPulse'

function formatLocalDateKey(value){
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function Diary(){
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => { fetchEntries() }, [])

  async function fetchEntries(){
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/diary')
      if(!res.ok){
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

  const entriesByDate = useMemo(() => {
    const map = {}
    entries.forEach((entry) => {
      const dateKey = formatLocalDateKey(entry.created_at)
      ;(map[dateKey] = map[dateKey] || []).push(entry)
    })
    return map
  }, [entries])

  const visibleEntries = useMemo(() => {
    if(!selectedDate) return entries
    return entries.filter((entry) => formatLocalDateKey(entry.created_at) === selectedDate)
  }, [entries, selectedDate])

  function openNewEntry(){
    setEditing(null)
    setError('')
    setOpen(true)
  }

  function openEditEntry(entry){
    setEditing(entry)
    setError('')
    setOpen(true)
  }

  async function handleSave(entry){
    if(!entry?.content?.trim()){
      setError('Write something before saving your entry.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const method = entry.id ? 'PUT' : 'POST'
      const url = entry.id ? `/api/diary/${entry.id}` : '/api/diary'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: entry.content.trim() }),
      })

      const payload = await res.json().catch(() => ({}))
      if(!res.ok) throw new Error(payload.error || 'Unable to save your entry.')

      if(!entry.id){
        await fetch('/api/gamification/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deltaEntries: 1 }),
        }).catch(() => null)
      }

      setOpen(false)
      setEditing(null)
      pulseWarmth(0.8, 1800)
      await fetchEntries()
    } catch (err) {
      setError(err.message || 'Unable to save your entry.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id){
    if(!confirm('Delete this entry?')) return

    setError('')
    try {
      const res = await fetch(`/api/diary/${id}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => ({}))
      if(!res.ok) throw new Error(payload.error || 'Unable to delete entry.')
      await fetchEntries()
    } catch (err) {
      setError(err.message || 'Unable to delete entry.')
    }
  }

  return (
    <RequireAuth>
      <AppShell>
      {loading ? (
        <DiarySkeleton />
      ) : (
        <div className="space-y-6">
          <Reveal>
            <DiaryRoomHero />
          </Reveal>

          {error ? (
            <motion.div
              className="diary-error-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
            >
              {error}
            </motion.div>
          ) : null}

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Reveal delay={0.06}>
                <div className="app-page-intro page-intro">
                  <div>
                    <p className="eyebrow">Private diary</p>
                    <h2 className="mt-2 section-title">Capture what today felt like.</h2>
                  </div>
                  <div className="flex flex-col gap-4 md:items-end md:justify-between">
                    <p className="subtle text-base leading-7 md:text-right">
                      {selectedDate
                        ? `Showing entries for ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString()}.`
                        : 'Your reflections arrive with softer motion and warmer presence around each saved moment.'}
                    </p>
                    <motion.div {...hoverGlow}>
                      <button
                        type="button"
                        onClick={openNewEntry}
                        className="soft-button soft-button-primary border-transparent whitespace-nowrap cursor-pointer"
                      >
                        New entry
                      </button>
                    </motion.div>
                  </div>
                </div>
              </Reveal>

              {selectedDate ? (
                <Reveal delay={0.08}>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="soft-button cursor-pointer text-sm"
                  >
                    Show all entries
                  </button>
                </Reveal>
              ) : null}

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {visibleEntries.map((entry, index) => (
                    <motion.article
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, y: 18, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.98 }}
                      transition={{ delay: index * 0.04, ...spring.gentle }}
                      className="card diary-entry-card p-4 cursor-default"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0 flex-1">
                          <time className="text-sm subtle" dateTime={entry.created_at}>
                            {new Date(entry.created_at).toLocaleString()}
                          </time>
                          <p className="mt-3 leading-7 whitespace-pre-wrap break-words">
                            {entry.content}
                          </p>
                        </div>
                        <div className="ml-4 flex shrink-0 flex-col gap-2">
                          <motion.button
                            type="button"
                            onClick={() => openEditEntry(entry)}
                            className="diary-action-link cursor-pointer"
                            {...hoverGlow}
                          >
                            Edit
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className="diary-action-link diary-action-link-danger cursor-pointer"
                            {...hoverGlow}
                          >
                            Delete
                          </motion.button>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>

                {!visibleEntries.length ? (
                  <Reveal>
                    <div className="card diary-empty-state p-8 text-center">
                      <p className="text-lg font-semibold">
                        {selectedDate ? 'No entries on this day' : 'No entries yet'}
                      </p>
                      <p className="mt-2 subtle">
                        {selectedDate
                          ? 'Pick another date on the calendar, or write something new for today.'
                          : 'Start with a single honest sentence and let the space build around you.'}
                      </p>
                      <motion.div className="mt-5" {...hoverGlow}>
                        <button
                          type="button"
                          onClick={openNewEntry}
                          className="soft-button soft-button-primary border-transparent cursor-pointer"
                        >
                          Write your first entry
                        </button>
                      </motion.div>
                    </div>
                  </Reveal>
                ) : null}
              </div>
            </div>

            <aside className="space-y-4">
              <Reveal delay={0.08}>
                <CalendarView
                  year={new Date().getFullYear()}
                  month={new Date().getMonth()}
                  entriesByDate={entriesByDate}
                  selectedDate={selectedDate}
                  onSelectDate={(date) => setSelectedDate(date === selectedDate ? null : date)}
                />
              </Reveal>
              <Reveal delay={0.12}>
                <div className="card p-4">
                  <h4 className="font-semibold text-lg">Selected date</h4>
                  <p className="mt-2 subtle">
                    {selectedDate
                      ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Tap a highlighted day to filter entries.'}
                  </p>
                  {selectedDate && entriesByDate[selectedDate]?.length ? (
                    <p className="mt-2 text-sm text-[var(--accent)]">
                      {entriesByDate[selectedDate].length} entr{entriesByDate[selectedDate].length === 1 ? 'y' : 'ies'}
                    </p>
                  ) : null}
                </div>
              </Reveal>
              <Reveal delay={0.16}>
                <div className="card p-4">
                  <h4 className="font-semibold text-lg">Milestones</h4>
                  <div className="mt-3">
                    <GamificationPanel />
                  </div>
                </div>
              </Reveal>
            </aside>
          </div>

          <DiaryEntryModal
            open={open}
            saving={saving}
            error={error}
            onClose={() => {
              setOpen(false)
              setEditing(null)
              setError('')
            }}
            onSave={handleSave}
            entry={editing}
          />
        </div>
      )}
      </AppShell>
    </RequireAuth>
  )
}

function GamificationPanel(){
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gamification/progress')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setProgress(data))
      .catch(() => setProgress(null))
      .finally(() => setLoading(false))
  }, [])

  if(loading) return <SkeletonText lines={4} />
  if(!progress) return <p className="subtle text-sm">Milestones will appear as you write and explore.</p>

  const badges = []
  if(progress.entries_count >= 3) badges.push('Journal Starter')
  if(progress.quotes_read >= 5) badges.push('Quote Explorer')
  if(progress.chat_interactions >= 5) badges.push('Heart Listener')

  return (
    <div className="space-y-2 text-sm">
      <div>Entries: <strong>{progress.entries_count}</strong></div>
      <div>Quotes Read: <strong>{progress.quotes_read}</strong></div>
      <div>Chat Interactions: <strong>{progress.chat_interactions}</strong></div>
      <div className="mt-3 flex flex-wrap gap-2">
        {badges.length
          ? badges.map((badge) => (
              <span key={badge} className="favorite-pill favorite-pill-active">{badge}</span>
            ))
          : <span className="subtle">No badges yet</span>}
      </div>
    </div>
  )
}
