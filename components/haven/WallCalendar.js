import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { dateKeyOf, intensityFor, isFutureDate, isPastDate, wordCount } from '../../lib/haven/dates'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const EASE = [0.22, 1, 0.36, 1]

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function entryCellClasses({ isFuture, isToday, lvl, isPastEntry }) {
  return cn(
    'haven-wall-calendar__cell',
    isFuture && 'haven-wall-calendar__cell--future',
    lvl === 1 && 'haven-wall-calendar__cell--lvl-1',
    lvl === 2 && 'haven-wall-calendar__cell--lvl-2',
    lvl === 3 && 'haven-wall-calendar__cell--lvl-3',
    isToday && 'haven-wall-calendar__cell--today',
    isPastEntry && 'haven-wall-calendar__cell--past-entry',
  )
}

function CalendarGrid({ today, entryMap, onSelect, year, month }) {
  const cells = useMemo(() => buildMonthCells(year, month), [year, month])

  return (
    <>
      <div className="haven-wall-calendar__weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="haven-wall-calendar__weekday">
            {d}
          </div>
        ))}
      </div>

      <div className="haven-wall-calendar__grid">
        {cells.map((d, i) => {
          if (!d) {
            return <div key={`empty-${year}-${month}-${i}`} className="haven-wall-calendar__cell haven-wall-calendar__cell--empty" />
          }

          const k = dateKeyOf(d)
          const isToday = Boolean(today && k === today)
          const isFuture = Boolean(today && isFutureDate(k, today))
          const isPast = Boolean(today && isPastDate(k, today))
          const entry = entryMap.get(k)
          const lvl = intensityFor(entry ? wordCount(entry.content) : 0)
          const isPastEntry = isPast && !!entry
          const ariaLabel = `${k}${entry ? ', entry' : ''}${isFuture ? ', unavailable' : ''}`

          if (isPastEntry) {
            return (
              <div
                key={k}
                role="button"
                tabIndex={-1}
                onClick={() => onSelect(k)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(k)
                  }
                }}
                className={entryCellClasses({ isFuture, isToday, lvl, isPastEntry: true })}
                aria-label={ariaLabel}
              >
                <span className="haven-wall-calendar__date">{d.getDate()}</span>
                <span className="haven-wall-calendar__dot" aria-hidden />
              </div>
            )
          }

          return (
            <button
              key={k}
              type="button"
              disabled={isFuture || (isPast && !entry)}
              onClick={() => onSelect(k)}
              className={entryCellClasses({ isFuture, isToday, lvl, isPastEntry: false })}
              aria-label={ariaLabel}
              aria-current={isToday ? 'date' : undefined}
            >
              <span className="haven-wall-calendar__date">{d.getDate()}</span>
              {entry ? <span className="haven-wall-calendar__dot" aria-hidden /> : null}
            </button>
          )
        })}
      </div>
    </>
  )
}

export default function WallCalendar({ today, entryMap, onSelect }) {
  const reduceMotion = useReducedMotion()
  const directionRef = useRef(0)
  const initializedRef = useRef(false)

  const anchor = useMemo(() => {
    if (today) return new Date(`${today}T12:00:00`)
    return new Date()
  }, [today])

  const [viewYear, setViewYear] = useState(() => anchor.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => anchor.getMonth())

  useEffect(() => {
    if (today && !initializedRef.current) {
      const d = new Date(`${today}T12:00:00`)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
      initializedRef.current = true
    }
  }, [today])

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [viewYear, viewMonth],
  )

  const pageKey = `${viewYear}-${viewMonth}`

  const isViewingCurrentMonth =
    today &&
    viewYear === anchor.getFullYear() &&
    viewMonth === anchor.getMonth()

  function setDirection(delta) {
    directionRef.current = delta
  }

  function goPrevMonth() {
    setDirection(-1)
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function goNextMonth() {
    setDirection(1)
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  function goPrevYear() {
    setDirection(-1)
    setViewYear((y) => y - 1)
  }

  function goNextYear() {
    setDirection(1)
    setViewYear((y) => y + 1)
  }

  function goToday() {
    if (!today) return
    const d = new Date(`${today}T12:00:00`)
    const ty = d.getFullYear()
    const tm = d.getMonth()
    if (ty > viewYear || (ty === viewYear && tm > viewMonth)) setDirection(1)
    else if (ty < viewYear || (ty === viewYear && tm < viewMonth)) setDirection(-1)
    else setDirection(0)
    setViewYear(ty)
    setViewMonth(tm)
  }

  const slideVariants = {
    enter: (dir) => ({
      opacity: 0,
      x: dir >= 0 ? 28 : -28,
      rotateY: dir >= 0 ? -5 : 5,
      scale: 0.985,
    }),
    center: {
      opacity: 1,
      x: 0,
      rotateY: 0,
      scale: 1,
      transition: { duration: 0.42, ease: EASE },
    },
    exit: (dir) => ({
      opacity: 0,
      x: dir >= 0 ? -22 : 22,
      rotateY: dir >= 0 ? 4 : -4,
      scale: 0.985,
      transition: { duration: 0.34, ease: EASE },
    }),
  }

  return (
    <div className="haven-wall-calendar rise rise-1">
      <div className="haven-wall-calendar__pin" aria-hidden />

      <header className="haven-wall-calendar__header">
        <div>
          <p className="haven-wall-calendar__label">Wall calendar</p>
          <h2 className="haven-wall-calendar__month">{monthLabel}</h2>
        </div>

        <nav className="haven-wall-calendar__nav" aria-label="Calendar navigation">
          <button
            type="button"
            className="haven-wall-calendar__nav-btn haven-wall-calendar__nav-btn--year"
            onClick={goPrevYear}
            aria-label="Previous year"
          >
            <ChevronsLeft size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="haven-wall-calendar__nav-btn"
            onClick={goPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="haven-wall-calendar__nav-today"
            onClick={goToday}
            disabled={!today || isViewingCurrentMonth}
            aria-label="Go to current month"
          >
            Today
          </button>
          <button
            type="button"
            className="haven-wall-calendar__nav-btn"
            onClick={goNextMonth}
            aria-label="Next month"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="haven-wall-calendar__nav-btn haven-wall-calendar__nav-btn--year"
            onClick={goNextYear}
            aria-label="Next year"
          >
            <ChevronsRight size={14} strokeWidth={1.75} />
          </button>
        </nav>
      </header>

      <div className="haven-wall-calendar__stage">
        <AnimatePresence mode="wait" custom={directionRef.current} initial={false}>
          {reduceMotion ? (
            <div key={pageKey}>
              <CalendarGrid
                today={today}
                entryMap={entryMap}
                onSelect={onSelect}
                year={viewYear}
                month={viewMonth}
              />
            </div>
          ) : (
            <motion.div
              key={pageKey}
              custom={directionRef.current}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="haven-wall-calendar__page"
              style={{ transformOrigin: directionRef.current >= 0 ? 'left center' : 'right center' }}
            >
              <CalendarGrid
                today={today}
                entryMap={entryMap}
                onSelect={onSelect}
                year={viewYear}
                month={viewMonth}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
