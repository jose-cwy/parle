import { sanitizeUsername } from './security/sanitize'

export function normalizePreferredName(value) {
  return sanitizeUsername(value).replace(/\s+/g, ' ')
}

export function hasPreferredName(user) {
  return normalizePreferredName(user?.preferred_name).length > 0
}
