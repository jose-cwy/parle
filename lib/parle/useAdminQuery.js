import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export function useAdminQuery(path) {
  const router = useRouter()
  const [state, setState] = useState({ status: 'loading', data: null })
  const range = router.query.range || '30'
  const from = router.query.from || ''
  const to = router.query.to || ''
  const search = router.query.q || ''
  const page = router.query.page || '1'

  useEffect(() => {
    if (!router.isReady) return undefined
    let active = true
    const params = new URLSearchParams()
    if (range) params.set('range', String(range))
    if (range === 'custom' && from) params.set('from', String(from))
    if (range === 'custom' && to) params.set('to', String(to))
    if (search) params.set('q', String(search))
    if (page) params.set('page', String(page))
    const qs = params.toString()
    fetch(`${path}${qs ? `?${qs}` : ''}`, { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.status === 404 || res.status === 401) return { status: 'missing' }
        if (!res.ok) return { status: 'error' }
        return { status: 'ok', data: await res.json() }
      })
      .then((next) => {
        if (active) setState(next)
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [router.isReady, path, range, from, to, search, page])

  return { ...state, range, from, to, search, page, router }
}
