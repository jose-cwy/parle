const STORAGE_KEY = 'parle.chat.archives.v1'
const MAX_ARCHIVES = 40

export function getChatArchives() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getChatArchiveById(id) {
  return getChatArchives().find((item) => item.id === id) || null
}

export function saveChatArchive({ id, title, messages, chatModeId }) {
  if (typeof window === 'undefined' || !id || !messages?.length) return

  const entry = {
    id,
    title: String(title || 'Conversation').slice(0, 80),
    messages,
    chatModeId: chatModeId || null,
    savedAt: Date.now(),
  }

  try {
    const next = [entry, ...getChatArchives().filter((item) => item.id !== id)].slice(
      0,
      MAX_ARCHIVES,
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota errors */
  }
}

export function removeChatArchive(id) {
  if (typeof window === 'undefined' || !id) return
  try {
    const next = getChatArchives().filter((item) => item.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function renameChatArchive(id, title) {
  if (typeof window === 'undefined' || !id) return false
  const trimmed = String(title || '').trim().slice(0, 80)
  if (!trimmed) return false

  try {
    const archives = getChatArchives()
    const index = archives.findIndex((item) => item.id === id)
    if (index === -1) return false

    const next = [...archives]
    next[index] = { ...next[index], title: trimmed }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function uniquifyArchiveTitle(title, excludeId) {
  const base = String(title || '').trim() || 'New Chat'
  const archives = getChatArchives().filter((item) => item.id !== excludeId)
  const titles = new Set(archives.map((item) => item.title))
  if (!titles.has(base)) return base.slice(0, 80)
  let n = 2
  while (titles.has(`${base} (${n})`)) n += 1
  return `${base} (${n})`.slice(0, 80)
}

const DATED_ARCHIVE_TITLE = /\s·\s\d{1,2}:\d{2}\s[AP]M$/i

function isLegacyAutoArchiveTitle(archive) {
  if (!archive?.title) return false
  if (DATED_ARCHIVE_TITLE.test(archive.title)) return true
  const first = (archive.messages || []).find((m) => m.role === 'user')
  if (!first?.text) return false
  const trimmed = String(first.text).trim()
  const short = trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed
  return archive.title === trimmed || archive.title === short
}

export function migrateLegacyArchiveTitles() {
  if (typeof window === 'undefined') return false
  const archives = getChatArchives()
  if (!archives.length) return false

  const needsMigration = archives.some(isLegacyAutoArchiveTitle)
  if (!needsMigration) return false

  const used = new Set()
  const next = archives.map((archive) => {
    if (!isLegacyAutoArchiveTitle(archive)) {
      used.add(archive.title)
      return archive
    }
    let title = 'New Chat'
    if (used.has(title)) {
      let n = 2
      while (used.has(`New Chat (${n})`)) n += 1
      title = `New Chat (${n})`
    }
    used.add(title)
    return { ...archive, title }
  })

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function formatSessionListDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Past conversation'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
