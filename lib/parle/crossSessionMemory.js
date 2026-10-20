function resolveCrossSessionSummary({
  memoryEnabled,
  lastSessionSummary,
  clientSummary,
} = {}) {
  if (!memoryEnabled) return null
  const stored = String(lastSessionSummary || '').trim()
  if (stored) return stored
  const client = String(clientSummary || '').trim()
  return client || null
}

function inspectMemoryContext({
  memoryEnabled,
  lastSessionSummary,
  resolvedSummary,
  isNewSession,
  history = [],
  livingProfileBlock = '',
  needles = [],
} = {}) {
  const summary = String(resolvedSummary || '')
  const historyText = (history || [])
    .map((m) => String(m.text || m.content || ''))
    .join('\n')
  const living = String(livingProfileBlock || '')
  const hits = (text) =>
    (needles || [])
      .map((n) => String(n || '').trim())
      .filter(Boolean)
      .filter((n) => new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text))

  return {
    memoryEnabled: Boolean(memoryEnabled),
    isNewSession: Boolean(isNewSession),
    hasStoredSummary: Boolean(String(lastSessionSummary || '').trim()),
    injectedSummary: Boolean(summary.trim()),
    summaryChars: summary.length,
    historyTurns: (history || []).length,
    livingInjected: Boolean(living.trim()),
    summaryNeedles: hits(summary),
    historyNeedles: hits(historyText),
    livingNeedles: hits(living),
  }
}

function logMemoryDiag(info) {
  const enabled =
    process.env.PARLE_MEMORY_DIAG === '1' || process.env.NODE_ENV === 'development'
  if (!enabled || !info) return
  console.log('[parle memory]', {
    memoryEnabled: info.memoryEnabled,
    isNewSession: info.isNewSession,
    hasStoredSummary: info.hasStoredSummary,
    injectedSummary: info.injectedSummary,
    summaryChars: info.summaryChars,
    historyTurns: info.historyTurns,
    livingInjected: info.livingInjected,
  })
}

function deniesCrossSessionMemory(text) {
  const raw = String(text || '').replace(/[\u2018\u2019]/g, "'")
  return /\b(don'?t|do not|doesn'?t)\s+(have|keep|retain)\s+(memories|memory|a memory)\b/i.test(raw) ||
    /\bno (memories|memory) (like that|of (that|this|it))\b/i.test(raw)
}

module.exports = {
  resolveCrossSessionSummary,
  inspectMemoryContext,
  logMemoryDiag,
  deniesCrossSessionMemory,
}
