function safeJson(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return '{}'
  }
}

export function track(event, props = {}) {
  const payload = {
    event,
    props,
    at: new Date().toISOString(),
    path: typeof window !== 'undefined' ? window.location.pathname : '',
  }

  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[hsc.event]', payload)
  }

  if (typeof fetch !== 'undefined') {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: safeJson(payload),
    }).catch(() => null)
  }
}

