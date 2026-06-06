export function normalizePreferredName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

export function hasPreferredName(user) {
  return normalizePreferredName(user?.preferred_name).length > 0
}
