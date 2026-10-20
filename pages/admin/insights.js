import { useEffect, useState } from 'react'
import Head from 'next/head'

function Rate({ label, n, d, pending, kind }) {
  if (kind === 'pending' || pending) {
    return (
      <p>
        <strong>{label}:</strong> pending ({n} / {d} matured; cohort still open)
      </p>
    )
  }
  if (kind === 'empty' || (!d && !n)) {
    return (
      <p>
        <strong>{label}:</strong> no matured cohort yet
      </p>
    )
  }
  const pct = d ? Math.round((n / d) * 1000) / 10 : 0
  return (
    <p>
      <strong>{label}:</strong> {n} / {d} ({pct}%)
    </p>
  )
}

export default function AdminInsightsPage() {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let active = true
    fetch('/api/admin/insights', { credentials: 'same-origin' })
      .then(async (res) => {
        if (res.status === 404) return { status: 'missing' }
        if (!res.ok) return { status: 'error' }
        const data = await res.json()
        return { status: 'ok', data }
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
  }, [])

  if (state.status === 'loading') {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>
  }
  if (state.status !== 'ok') {
    return (
      <>
        <Head>
          <title>Not found</title>
        </Head>
        <p className="p-8 text-sm">Not found.</p>
      </>
    )
  }

  const data = state.data
  return (
    <>
      <Head>
        <title>parlé insights</title>
      </Head>
      <main className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">parlé</p>
        <h1 className="mt-2 font-serif text-[28px]">Insights</h1>
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
          UTC calendar days. Verified retention uses server-confirmed authenticated sends from{' '}
          {data.verifiedFrom}. Historical activation before that date is estimated. Automatic
          deletion of analytics events is not implemented.
        </p>
        {!data.available ? (
          <p className="mt-6 text-sm">Analytics schema is not available in this environment.</p>
        ) : (
          <section className="mt-8 space-y-3 text-[13px] leading-relaxed">
            <p>
              <strong>DAU (today):</strong> {data.dau?.n ?? 0}
            </p>
            <p>
              <strong>Activated users:</strong> {data.newActivated?.n ?? 0} total;{' '}
              {data.newActivated?.verifiedN ?? 0} verified; {data.newActivated?.estimatedN ?? 0}{' '}
              estimated historical
            </p>
            <Rate label="D1" {...(data.d1 || {})} />
            <Rate label="D7" {...(data.d7 || {})} />
            <p>
              <strong>Relief:</strong> shown {data.relief?.shown ?? 0}, skipped {data.relief?.skipped ?? 0},
              answered {data.relief?.answered ?? 0}
              {data.relief?.options
                ? ` — ${Object.entries(data.relief.options)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(', ') || 'no answers'}`
                : ''}
            </p>
            <p>
              <strong>Clarity:</strong> shown {data.clarity?.shown ?? 0}, skipped {data.clarity?.skipped ?? 0},
              answered {data.clarity?.answered ?? 0}
              {data.clarity?.options
                ? ` — ${Object.entries(data.clarity.options)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(', ') || 'no answers'}`
                : ''}
            </p>
            <p>
              <strong>Thumbs:</strong> {data.thumbs?.up ?? 0} up / {data.thumbs?.down ?? 0} down of{' '}
              {data.thumbs?.total ?? 0}
            </p>
            <p>
              <strong>Guest messages:</strong> {data.guest?.messages ?? 0}
            </p>
            <p>
              <strong>Modes:</strong>{' '}
              {(data.modes || []).map((row) => `${row.mode_id} ${row.n}`).join(', ') || 'none yet'}
            </p>
          </section>
        )}
      </main>
    </>
  )
}
