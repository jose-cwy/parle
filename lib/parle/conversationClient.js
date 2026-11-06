const SELECTED_KEY = 'parle.v2.selectedConversation'
const TITLE_KEY = 'parle.v2.conversationTitles'

function v2TestHeaders() {
  if (typeof window === 'undefined') return {}
  const stub = window.__PARLE_V2_STUB
  if (!stub) return {}
  return { 'x-parle-v2-stub': String(stub) }
}

export async function listConversations({ status = 'active' } = {}) {
  const query = status === 'archived' ? '?status=archived' : ''
  const res = await fetch(`/api/conversations${query}`)
  if (res.status === 401) return { unauthorized: true, conversations: [] }
  if (!res.ok) {
    const error = new Error('list_failed')
    error.status = res.status
    throw error
  }
  const data = await res.json().catch(() => ({}))
  return {
    conversations: Array.isArray(data.conversations) ? data.conversations : [],
    generation: data.generation || { available: true, recovery: false, mode: 'live' },
  }
}

export async function createConversation(modeId = 'cross') {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modeId }),
  })
  if (!res.ok) {
    const error = new Error('create_failed')
    error.status = res.status
    throw error
  }
  const data = await res.json()
  return data.conversation
}

export async function listLegacyHistory() {
  const res = await fetch('/api/conversations/legacy')
  if (res.status === 401) return { unauthorized: true, conversation: null, migration: { state: 'absent' } }
  if (!res.ok) {
    const error = new Error('legacy_list_failed')
    error.status = res.status
    throw error
  }
  const data = await res.json().catch(() => ({}))
  return {
    conversation: data.conversation || null,
    migration: data.migration || { state: 'absent' },
    generation: data.generation || { available: true, recovery: false, mode: 'live' },
  }
}

export async function getConversation(id, { cursor, limit, version } = {}) {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', String(cursor))
  if (limit) params.set('limit', String(limit))
  if (version) params.set('v', String(version))
  const query = params.toString() ? `?${params}` : ''
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}${query}`)
  if (res.status === 404) return null
  if (!res.ok) {
    const error = new Error('get_failed')
    error.status = res.status
    error.body = await res.json().catch(() => ({}))
    throw error
  }
  return res.json()
}

export function postConversationMessage(id, body, { signal } = {}) {
  const stub = typeof window !== 'undefined' ? window.__PARLE_V2_STUB : null
  return fetch(`/api/conversations/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...v2TestHeaders() },
    body: JSON.stringify(stub ? { ...body, testStub: stub } : body),
    signal,
  })
}

export async function archiveConversation(id) {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'archived' }),
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const error = new Error('archive_failed')
    error.status = res.status
    throw error
  }
  const data = await res.json().catch(() => ({}))
  return data.conversation || null
}

export async function restoreConversation(id) {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'active' }),
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const error = new Error('restore_failed')
    error.status = res.status
    throw error
  }
  const data = await res.json().catch(() => ({}))
  return data.conversation || null
}

export function persistConversationUrl(conversationId) {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    if (!conversationId) url.searchParams.delete('c')
    else url.searchParams.set('c', String(conversationId))
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    /* ignore */
  }
}

export function readConversationIdFromUrl(search) {
  try {
    let query = search
    if (query == null) {
      query = typeof window !== 'undefined' ? window.location.search : ''
    } else {
      query = String(query)
      if (query.startsWith('http://') || query.startsWith('https://')) {
        query = new URL(query).search
      } else if (query && !query.startsWith('?')) {
        query = `?${query}`
      }
    }
    const value = new URLSearchParams(query).get('c')
    const trimmed = String(value || '').trim()
    return trimmed || null
  } catch {
    return null
  }
}

export function loadStoredConversationId(userId) {
  if (!userId) return null
  try {
    if (typeof localStorage !== 'undefined') {
      const fromLocal = localStorage.getItem(`${SELECTED_KEY}:${userId}`)
      if (fromLocal) return fromLocal
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(`${SELECTED_KEY}:${userId}`)
    }
  } catch {
    return null
  }
  return null
}

export function resolveConversationSelection({
  urlId = null,
  storedId = null,
  conversations = [],
  archivedConversations = [],
} = {}) {
  const listed = [...conversations, ...archivedConversations]
  const inList = (id) => listed.some((row) => row && row.id === id)

  if (urlId) {
    return {
      source: 'url',
      requestedId: urlId,
      fetchId: urlId,
      listed: inList(urlId),
      allowListFallback: false,
    }
  }
  if (storedId) {
    return {
      source: 'stored',
      requestedId: storedId,
      fetchId: storedId,
      listed: inList(storedId),
      allowListFallback: false,
    }
  }
  const first = conversations[0] || null
  return {
    source: first ? 'list' : 'none',
    requestedId: null,
    fetchId: first ? first.id : null,
    listed: Boolean(first),
    allowListFallback: true,
  }
}

export function shouldApplyBootstrappedConversation({
  bootGen,
  currentGen,
  fetchId,
  urlId,
  activeId,
} = {}) {
  if (Number(bootGen) !== Number(currentGen)) return false
  if (fetchId && urlId && String(urlId) !== String(fetchId)) return false
  if (fetchId && activeId && String(activeId) !== String(fetchId)) return false
  return true
}

/**
 * New Chat remember() writes the created UUID onto the ref before React
 * state flushes. A render-time `ref = state` copy would restore the previous
 * chat and POST the next send to the wrong conversation.
 */
export function resolveActiveConversationRef({
  creating = false,
  createPending = false,
  renderedId = null,
  rememberedId = null,
} = {}) {
  if (creating || createPending) {
    return rememberedId == null ? renderedId : rememberedId
  }
  return renderedId
}

export function loadSelectedConversationId(userId) {
  return readConversationIdFromUrl() || loadStoredConversationId(userId)
}

export function saveSelectedConversationId(userId, conversationId) {
  persistConversationUrl(conversationId)
  if (!userId) return
  try {
    const key = `${SELECTED_KEY}:${userId}`
    if (!conversationId) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key)
      return
    }
    const value = String(conversationId)
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function loadConversationTitles(userId) {
  if (typeof localStorage === 'undefined' || !userId) return {}
  try {
    const raw = localStorage.getItem(`${TITLE_KEY}:${userId}`)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveConversationTitle(userId, conversationId, title) {
  if (typeof localStorage === 'undefined' || !userId || !conversationId) return
  const trimmed = String(title || '').trim().slice(0, 80)
  if (!trimmed) return
  try {
    const next = { ...loadConversationTitles(userId), [conversationId]: trimmed }
    localStorage.setItem(`${TITLE_KEY}:${userId}`, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function mapConversationMessages(payload) {
  return (payload?.messages || []).map((row) => ({
    id: row.id != null ? String(row.id) : undefined,
    role: row.role === 'user' || row.role === 'assistant' ? row.role : 'assistant',
    text: row.text,
    at: row.created_at ? new Date(row.created_at).getTime() : undefined,
  }))
}

export function mergeLegacyPages(existing, incoming) {
  const current = Array.isArray(existing) ? existing : []
  const next = Array.isArray(incoming) ? incoming : []
  const seen = new Set(current.map((row) => row.id).filter(Boolean))
  const added = []
  for (const row of next) {
    if (row?.id && seen.has(row.id)) continue
    if (row?.id) seen.add(row.id)
    added.push(row)
  }
  return current.concat(added)
}
