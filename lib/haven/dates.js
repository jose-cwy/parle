export function todayKey() {
  const d = new Date()
  return dateKeyOf(d)
}

export function dateKeyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatLocalDateKey(value) {
  return dateKeyOf(new Date(value))
}

/** Parse YYYY-MM-DD from Postgres DATE without timezone shift. */
export function parseCalendarDate(value) {
  if (value == null) return null
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
  }
  return formatLocalDateKey(value)
}

export function isToday(dateKey, today = todayKey()) {
  return dateKey === today
}

export function isPastDate(dateKey, today = todayKey()) {
  return dateKey < today
}

export function isFutureDate(dateKey, today = todayKey()) {
  return dateKey > today
}

export function isEditableDate(dateKey, today = todayKey()) {
  return isToday(dateKey, today)
}

export function wordCount(s) {
  const t = String(s || '').trim()
  return t ? t.split(/\s+/).length : 0
}

export function intensityFor(words) {
  if (words === 0) return 0
  if (words < 20) return 1
  if (words < 60) return 2
  return 3
}

export function displayName(user) {
  if (!user?.email) return 'friend'
  const name = user.email.split('@')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function timeGreeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still awake'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
