export const THEME_STORAGE_KEY = 'parle.theme'

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
}

export const DEFAULT_THEME = THEMES.DARK

export function resolveTheme(value) {
  if (value === THEMES.LIGHT) return THEMES.LIGHT
  if (value === THEMES.DARK) return THEMES.DARK
  return DEFAULT_THEME
}

export function getStoredTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === THEMES.LIGHT || stored === THEMES.DARK) return stored
    return DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return DEFAULT_THEME
  const resolved = resolveTheme(theme)
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  return resolved
}

export function setStoredTheme(theme) {
  const resolved = applyTheme(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, resolved)
  } catch {
    /* ignore */
  }
  return resolved
}
