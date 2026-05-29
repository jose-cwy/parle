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
