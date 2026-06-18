const LIMITS = {
  chatMessage: 2000,
  journalEntry: 10000,
  username: 50,
  transcript: 3000,
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
}

function sanitizeText(value, maxLen) {
  return stripHtml(value)
    .replace(/\s{10,}/g, ' ')
    .trim()
    .slice(0, maxLen)
}

function sanitizeChatMessage(value) {
  return sanitizeText(value, LIMITS.chatMessage)
}

function sanitizeJournalContent(value) {
  return sanitizeText(value, LIMITS.journalEntry)
}

function sanitizeUsername(value) {
  return sanitizeText(value, LIMITS.username)
}

function sanitizeTranscript(value) {
  return sanitizeText(value, LIMITS.transcript)
}

module.exports = {
  LIMITS,
  stripHtml,
  sanitizeText,
  sanitizeChatMessage,
  sanitizeJournalContent,
  sanitizeUsername,
  sanitizeTranscript,
}
