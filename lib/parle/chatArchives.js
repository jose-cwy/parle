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

export function formatSessionListDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Past conversation'
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}
