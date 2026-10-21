function utcToday() {
  return new Date().toISOString().slice(0, 10)
}

function addUtcDays(isoDate, days) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function parseAdminRange(query = {}) {
  const today = utcToday()
  const preset = String(query.range || '30')
  let from
  let to
  let range = preset

  if (preset === 'custom' && isIsoDate(query.from) && isIsoDate(query.to)) {
    from = query.from
    to = query.to
    range = 'custom'
  } else {
    const days = preset === '7' || preset === '90' ? Number(preset) : 30
    range = String(days)
    to = today
    from = addUtcDays(today, -(days - 1))
  }

  if (from > to) {
    const swap = from
    from = to
    to = swap
  }

  const span = Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000,
  ) + 1
  if (span > 366) {
    from = addUtcDays(to, -89)
    range = '90'
  }

  const days =
    Math.floor(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000,
    ) + 1

  return { from, to, range, days }
}

module.exports = {
  utcToday,
  addUtcDays,
  isIsoDate,
  parseAdminRange,
}
