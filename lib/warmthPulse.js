export function pulseWarmth(amount = 1, durationMs = 1400) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--warmth', String(amount))
  window.setTimeout(() => {
    root.style.setProperty('--warmth', '0')
  }, durationMs)
}

