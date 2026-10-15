function asDeletedSet(deletedIds) {
  if (!deletedIds) return null
  if (deletedIds instanceof Set) return deletedIds
  if (Array.isArray(deletedIds)) return new Set(deletedIds)
  return null
}

function shouldIgnoreCommit({ storageKey, deletedIds, opGen, currentOpGen } = {}) {
  const deleted = asDeletedSet(deletedIds)
  if (storageKey && deleted && deleted.has(storageKey)) return true
  if (Number.isFinite(Number(opGen)) && Number.isFinite(Number(currentOpGen))) {
    return Number(opGen) !== Number(currentOpGen)
  }
  return false
}

module.exports = {
  shouldIgnoreCommit,
}
