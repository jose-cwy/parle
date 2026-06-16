export const SETTINGS_CACHE_KEY = 'parle_settings_cache'

export const DEFAULT_SETTINGS_CACHE = {
  memory_enabled: false,
  personalisation_enabled: false,
}

export function readSettingsCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      memory_enabled: Boolean(parsed.memory_enabled),
      personalisation_enabled: Boolean(parsed.personalisation_enabled),
    }
  } catch {
    return null
  }
}

export function writeSettingsCache(settings) {
  if (typeof window === 'undefined' || !settings) return
  try {
    localStorage.setItem(
      SETTINGS_CACHE_KEY,
      JSON.stringify({
        memory_enabled: Boolean(settings.memory_enabled),
        personalisation_enabled: Boolean(settings.personalisation_enabled),
      }),
    )
  } catch {
    /* ignore quota errors */
  }
}

export function clearSettingsCache() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SETTINGS_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

export function settingsEqual(a, b) {
  if (!a || !b) return false
  return (
    Boolean(a.memory_enabled) === Boolean(b.memory_enabled)
    && Boolean(a.personalisation_enabled) === Boolean(b.personalisation_enabled)
  )
}
