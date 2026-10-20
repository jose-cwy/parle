function parseEmailList(raw) {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
}

function isExcludedMetricsEmail(email, env = process.env) {
  const value = String(email || '').trim().toLowerCase()
  if (!value) return true
  if (value.endsWith('@parle.test')) return true
  const extra = parseEmailList(env.METRICS_EXCLUDE_EMAILS)
  return extra.includes(value)
}

function parseAdminEmails(env = process.env) {
  return parseEmailList(env.ADMIN_EMAILS)
}

function isAdminEmail(email, env = process.env) {
  const value = String(email || '').trim().toLowerCase()
  if (!value) return false
  return parseAdminEmails(env).includes(value)
}

function analyticsVerifiedFrom(env = process.env) {
  const raw = String(env.PARLE_ANALYTICS_VERIFIED_FROM || '2026-10-20').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '2026-10-20'
  return raw
}

module.exports = {
  parseEmailList,
  isExcludedMetricsEmail,
  parseAdminEmails,
  isAdminEmail,
  analyticsVerifiedFrom,
}
