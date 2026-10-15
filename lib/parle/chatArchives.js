const { getChatLocalUserId } = require('./chatPreferences')

const STORAGE_KEY = 'parle.chat.archives.v1'
const DELETED_KEY = 'parle.chat.archives.deleted.v1'
const MAX_ARCHIVES = 40
const MAX_DELETED = 200

function archivesKey() {
  const userId = getChatLocalUserId()
  return userId ? `${STORAGE_KEY}:${userId}` : null
}

function deletedKey() {
  const userId = getChatLocalUserId()
  return userId ? `${DELETED_KEY}:${userId}` : null
}

function getDeletedArchiveIds() {
  if (typeof window === 'undefined') return []
  const key = deletedKey()
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function persistDeletedIds(ids) {
  const key = deletedKey()
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify((ids || []).slice(0, MAX_DELETED)))
  } catch {
    /* ignore */
  }
}

function isArchiveDeleted(id) {
  if (!id) return false
  return getDeletedArchiveIds().includes(String(id))
}

function tombstoneArchiveId(id) {
  if (typeof window === 'undefined' || !id) return
  const value = String(id)
  const ids = getDeletedArchiveIds()
  if (ids.includes(value)) return
  persistDeletedIds([value, ...ids])
}

function getChatArchives() {
  if (typeof window === 'undefined') return []
  const key = archivesKey()
  // Guests and signed-out sessions have no durable sidebar archives
  if (!key) return []
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function getChatArchiveById(id) {
  return getChatArchives().find((item) => item.id === id) || null
}

function getTranscriptFingerprint(messages) {
  return (messages || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role}:${String(m.text || '').trim()}`)
    .join('|')
}

function archivesMatchMessages(a, b) {
  const left = getTranscriptFingerprint(a)
  const right = getTranscriptFingerprint(b)
  return left.length > 0 && left === right
}

function pruneArchivesMatchingMessages(messages) {
  if (typeof window === 'undefined') return false
  const key = archivesKey()
  if (!key) return false
  const fingerprint = getTranscriptFingerprint(messages)
  if (!fingerprint) return false

  const archives = getChatArchives()
  const removed = archives.filter(
    (archive) => getTranscriptFingerprint(archive.messages) === fingerprint,
  )
  const next = archives.filter(
    (archive) => getTranscriptFingerprint(archive.messages) !== fingerprint,
  )
  if (next.length === archives.length) return false

  for (const archive of removed) {
    tombstoneArchiveId(archive.id)
  }

  try {
    localStorage.setItem(key, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

function saveChatArchive({ id, title, messages, chatModeId, bumpOrder = false }) {
  if (typeof window === 'undefined' || !id || !messages?.length) return false
  if (isArchiveDeleted(id)) return false
  const key = archivesKey()
  if (!key) return false

  const archives = getChatArchives()
  const existing = archives.find((item) => item.id === id)
  const entry = {
    id,
    title: String(title || 'Conversation').slice(0, 80),
    messages,
    chatModeId: chatModeId || null,
    savedAt: bumpOrder ? Date.now() : (existing?.savedAt ?? Date.now()),
  }

  try {
    let next
    if (bumpOrder) {
      next = [entry, ...archives.filter((item) => item.id !== id)]
    } else if (existing) {
      next = archives.map((item) => (item.id === id ? entry : item))
    } else {
      next = [...archives, entry]
    }
    localStorage.setItem(key, JSON.stringify(next.slice(0, MAX_ARCHIVES)))
    return true
  } catch {
    return false
  }
}

function removeChatArchive(id) {
  if (typeof window === 'undefined' || !id) return
  tombstoneArchiveId(id)
  const key = archivesKey()
  if (!key) return
  try {
    const next = getChatArchives().filter((item) => item.id !== id)
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function renameChatArchive(id, title) {
  if (typeof window === 'undefined' || !id) return false
  const key = archivesKey()
  if (!key) return false
  const trimmed = String(title || '').trim().slice(0, 80)
  if (!trimmed) return false

  try {
    const archives = getChatArchives()
    const index = archives.findIndex((item) => item.id === id)
    if (index === -1) return false

    const next = [...archives]
    next[index] = { ...next[index], title: trimmed }
    localStorage.setItem(key, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

function uniquifyArchiveTitle(title, excludeId) {
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
  if (archive?.legacyTitleMigrated) return false
  if (!archive?.title) return false
  if (DATED_ARCHIVE_TITLE.test(archive.title)) return true
  const first = (archive.messages || []).find((m) => m.role === 'user')
  if (!first?.text) return false
  const trimmed = String(first.text).trim()
  const short = trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed
  return archive.title === trimmed || archive.title === short
}

function migrateLegacyArchiveTitles() {
  if (typeof window === 'undefined') return false
  const key = archivesKey()
  if (!key) return false
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
    return { ...archive, title, legacyTitleMigrated: true }
  })

  try {
    localStorage.setItem(key, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

function formatSessionListDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Past conversation'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

module.exports = {
  getDeletedArchiveIds,
  isArchiveDeleted,
  tombstoneArchiveId,
  getChatArchives,
  getChatArchiveById,
  archivesMatchMessages,
  pruneArchivesMatchingMessages,
  saveChatArchive,
  removeChatArchive,
  renameChatArchive,
  uniquifyArchiveTitle,
  migrateLegacyArchiveTitles,
  formatSessionListDate,
}
