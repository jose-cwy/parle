import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { spring } from '../lib/motion'

function formatLocalDateKey(date){
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function CalendarView({ year, month, entriesByDate, selectedDate, onSelectDate }){
  const monthLabel = new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const activeDays = Object.keys(entriesByDate).length

  const weeks = useMemo(() => {
    const d = new Date(year, month, 1)
    const startDay = d.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for(let i = 0; i < startDay; i++) cells.push(null)
    for(let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
    while(cells.length % 7 !== 0) cells.push(null)
    const rows = []
    for(let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [year, month])

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Journal map</p>
          <h4 className="mt-1 font-semibold text-lg">{monthLabel}</h4>
        </div>
        <div className="rounded-full border border-[var(--border)] bg-[rgba(3,12,28,0.75)] px-3 py-1 text-xs text-[var(--text-soft)]">
          {activeDays} active day{activeDays === 1 ? '' : 's'}
        </div>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-2 text-xs uppercase tracking-wide subtle">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div key={label} className="text-center">{label}</div>
        ))}
      </div>
      {weeks.map((row, ri) => (
        <div key={ri} className="mb-2 grid grid-cols-7 gap-2">
          {row.map((cell, ci) => {
            if(!cell) return <div key={ci} className="h-10" aria-hidden="true" />
            const key = formatLocalDateKey(cell)
            const hasEntries = entriesByDate[key]?.length > 0
            const isSelected = selectedDate === key
            const isToday = key === formatLocalDateKey(new Date())

            return (
              <motion.button
                key={ci}
                type="button"
                onClick={() => onSelectDate(key)}
                whileHover={{ y: -2, scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.breath}
                className={`calendar-day cursor-pointer ${hasEntries ? 'calendar-day-active' : ''} ${isSelected ? 'calendar-day-selected' : ''} ${isToday ? 'calendar-day-today' : ''}`}
                aria-label={`${cell.toLocaleDateString()}${hasEntries ? ', has entries' : ''}${isSelected ? ', selected' : ''}`}
                aria-pressed={isSelected}
              >
                {cell.getDate()}
              </motion.button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
