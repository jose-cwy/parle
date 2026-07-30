const PREFERRED_MODE_KEY = 'parle.chat.preferredMode.v1'
const LIVE_SESSION_META_KEY = 'parle.chat.liveSessionMeta.v1'
const PREFERRED_MODE_TTL_MS = 30 * 60 * 1000

let activeUserId = null

export function setChatLocalUserId(userId) {
  activeUserId = userId != null && userId !== '' ? String(userId) : null
}

export function getChatLocalUserId() {
  return activeUserId
}

function liveSessionMetaKey() {
  return activeUserId ? `${LIVE_SESSION_META_KEY}:${activeUserId}` : LIVE_SESSION_META_KEY
}

export function getPreferredModeId(defaultModeId = 'cross') {
  if (typeof window === 'undefined') return defaultModeId
  try {
    const raw = localStorage.getItem(PREFERRED_MODE_KEY)
    if (!raw) return defaultModeId
    const parsed = JSON.parse(raw)
    const modeId = parsed?.modeId
    const savedAt = parsed?.savedAt
    if (!modeId || typeof savedAt !== 'number') {
      localStorage.removeItem(PREFERRED_MODE_KEY)
      return defaultModeId
    }
    if (Date.now() - savedAt > PREFERRED_MODE_TTL_MS) {
      localStorage.removeItem(PREFERRED_MODE_KEY)
      return defaultModeId
    }
    return modeId
  } catch {
    return defaultModeId
  }
}

export function setPreferredModeId(modeId) {
  if (typeof window === 'undefined' || !modeId) return
  try {
    localStorage.setItem(
      PREFERRED_MODE_KEY,
      JSON.stringify({ modeId, savedAt: Date.now() }),
    )
  } catch {
    /* ignore quota errors */
  }
}

export function loadLiveSessionMeta() {
  if (typeof window === 'undefined') return null
  // Guests / signed-out: never restore a live session title from shared storage
  if (!activeUserId) return null
  try {
    const raw = localStorage.getItem(liveSessionMetaKey())
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function saveLiveSessionMeta(partial) {
  if (typeof window === 'undefined' || !partial || !activeUserId) return
  try {
    const prev = loadLiveSessionMeta() || {}
    localStorage.setItem(
      liveSessionMetaKey(),
      JSON.stringify({
        ...prev,
        ...partial,
        updatedAt: Date.now(),
      }),
    )
  } catch {
    /* ignore quota errors */
  }
}

export function clearLiveSessionMeta() {
  if (typeof window === 'undefined') return
  try {
    if (activeUserId) {
      localStorage.removeItem(liveSessionMetaKey())
    }
    localStorage.removeItem(LIVE_SESSION_META_KEY)
  } catch {
    /* ignore */
  }
}
