import Head from 'next/head'
import { AdminKpi, AdminRange } from './AdminShell'

export function AdminHead({ title }) {
  return (
    <Head>
      <title>{title} — parlé admin</title>
    </Head>
  )
}

export function AdminStatus({ status, children }) {
  if (status === 'loading') return <p className="admin-loading">Loading…</p>
  if (status !== 'ok') {
    return (
      <>
        <AdminHead title="Not found" />
        <p className="admin-empty">Not found.</p>
      </>
    )
  }
  return children
}

export function AdminHeader({ title, range, from, to, note }) {
  return (
    <>
      <p className="text-[9px] uppercase tracking-[0.24em] text-[#b8877a]">Control Centre</p>
      <h1 className="font-serif text-[28px] mt-1">{title}</h1>
      {note ? <p className="text-[12px] text-[#9a9088] mt-2 max-w-2xl leading-relaxed">{note}</p> : null}
      {range ? <AdminRange range={range} from={from} to={to} /> : null}
    </>
  )
}

export function Unavailable({ message }) {
  return <div className="admin-unavailable">{message}</div>
}

export { AdminKpi }
