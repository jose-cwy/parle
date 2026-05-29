import { dateKeyOf, formatLocalDateKey, parseCalendarDate, todayKey } from './haven/dates'

function previousDayKey(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return dateKeyOf(d)
}

/** Calendar cell key — prefers entry_date; corrects legacy one-day drift vs created_at. */
export function calendarDateKeyFromEntry(entry) {
  const fromEntry = entry?.entry_date ? parseCalendarDate(entry.entry_date) : null
  const fromCreated = entry?.created_at ? formatLocalDateKey(entry.created_at) : null
  if (!fromEntry) return fromCreated
  if (!fromCreated) return fromEntry
  if (fromEntry !== fromCreated && fromEntry === previousDayKey(fromCreated)) {
    return fromCreated
  }
  return fromEntry
}

export function entryDateKeyFromRow(row) {
  return calendarDateKeyFromEntry(row)
}

export function isRowEditableOnClient(row, clientToday) {
  const stored = entryDateKeyFromRow(row)
  if (!stored || stored === clientToday) return true
  return stored === previousDayKey(clientToday)
}

export {
  todayKey as getTodayDateKey,
  dateKeyOf as getDateKey,
  todayKey,
  isToday,
  isPastDate,
  isFutureDate,
  isEditableDate,
} from './haven/dates'
