const GUEST_CHAT_DRAFT_KEY = 'parle.chat.guestDraft.v1'
const MAX_DRAFT_MESSAGES = 200

function sanitizeDraftMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
    .slice(-MAX_DRAFT_MESSAGES)
    .map((m) => ({
      id: m.id || undefined,
      role: m.role,
      text: String(m.text || ''),
      at: typeof m.at === 'number' ? m.at : Date.now(),
      ...(m.ephemeral ? { ephemeral: true } : {}),
      ...(m.modeId ? { modeId: m.modeId } : {}),
    }))
}

export function saveGuestChatDraft({ messages, chatModeId, pendingModeId } = {}) {
  if (typeof window === 'undefined') return
  const nextMessages = sanitizeDraftMessages(messages)
  try {
    if (!nextMessages.length) {
      sessionStorage.removeItem(GUEST_CHAT_DRAFT_KEY)
      return
    }
    sessionStorage.setItem(
      GUEST_CHAT_DRAFT_KEY,
      JSON.stringify({
        messages: nextMessages,
        chatModeId: chatModeId || null,
        pendingModeId: pendingModeId || null,
        savedAt: Date.now(),
      }),
    )
  } catch {
    /* ignore quota errors */
  }
}

export function loadGuestChatDraft() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(GUEST_CHAT_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const messages = sanitizeDraftMessages(parsed.messages)
    if (!messages.length) return null
    return {
      messages,
      chatModeId: parsed.chatModeId || null,
      pendingModeId: parsed.pendingModeId || null,
    }
  } catch {
    return null
  }
}

export function clearGuestChatDraft() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(GUEST_CHAT_DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

export function guestDraftHasUserMessages(draft) {
  return Boolean(draft?.messages?.some((m) => m.role === 'user' && String(m.text || '').trim()))
}
