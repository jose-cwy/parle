import { todayKey } from './haven/dates'

const HEADER = 'x-client-date'

export function getClientTodayFromReq(req) {
  const raw = req?.headers?.[HEADER] ?? req?.headers?.[HEADER.toUpperCase()]
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  return todayKey()
}

export function journalClientHeaders(clientToday = todayKey()) {
  return { 'X-Client-Date': clientToday }
}
