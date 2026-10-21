import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AdminBarChart, AdminHBar } from '../../../components/admin/AdminCharts'
import { AdminHead, AdminHeader, AdminKpi, AdminStatus, Unavailable } from '../../../components/admin/AdminGate'
import { requireAdminUserDetailGssp } from '../../../lib/parle/adminPage'

export const getServerSideProps = requireAdminUserDetailGssp

function fmt(value) {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 16)
}

export default function AdminUserDetailPage({ userId }) {
  const [state, setState] = useState({ status: 'loading', data: null })

  useEffect(() => {
    let active = true
    fetch(`/api/admin/users/${userId}`, { credentials: 'same-origin' })
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
  }, [userId])

  const user = state.data?.user
  return (
    <AdminStatus status={state.status}>
      <AdminHead title={user?.email || 'User'} />
      <AdminHeader title={user?.email || 'User'} note="Read-only usage. No transcripts, journals, profiles, passwords or tokens." />
      <p className="mb-3">
        <Link href="/admin/users" className="text-[#f0c7c2] text-sm">
          ← Users
        </Link>
      </p>
      {!state.data?.available || !user ? (
        <Unavailable message="This account is not available." />
      ) : (
        <>
          <div className="admin-kpis">
            <AdminKpi label="Registered" value={fmt(user.created_at)} />
            <AdminKpi label="Activated" value={fmt(user.first_activated_at)} />
            <AdminKpi label="Last activity" value={fmt(user.last_active_at)} />
            <AdminKpi label="Messages" value={user.messages} />
            <AdminKpi label="Conversations" value={user.conversations} />
            <AdminKpi label="Memory" value={user.memory_enabled ? 'on' : 'off'} hint={`Personalisation ${user.personalisation_enabled ? 'on' : 'off'}`} />
          </div>
          <div className="admin-panel">
            <h2>Messages (last 90 days with activity)</h2>
            <AdminBarChart
              rows={[...(state.data.daily || [])].reverse()}
              xKey="day"
              series={[{ key: 'n', label: 'Messages', color: '#c54b44' }]}
            />
          </div>
          <div className="admin-panel">
            <h2>Mode mix</h2>
            <AdminHBar rows={state.data.modes} />
          </div>
          <div className="admin-panel text-sm">
            <p>
              Thumbs: {state.data.thumbs?.up || 0} up / {state.data.thumbs?.down || 0} down. Survey
              prompts shown {state.data.surveys?.shown || 0}, skipped {state.data.surveys?.skipped || 0}.
              Individual relief/clarity answers are not shown.
            </p>
          </div>
        </>
      )}
    </AdminStatus>
  )
}
