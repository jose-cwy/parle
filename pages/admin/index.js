import { AdminBarChart, AdminHBar, formatPct } from '../../components/admin/AdminCharts'
import { AdminHead, AdminHeader, AdminKpi, AdminStatus, Unavailable } from '../../components/admin/AdminGate'
import { requireAdminGssp } from '../../lib/parle/adminPage'
import { useAdminQuery } from '../../lib/parle/useAdminQuery'

export const getServerSideProps = requireAdminGssp

export default function AdminOverviewPage() {
  const { status, data, range, from, to } = useAdminQuery('/api/admin/overview')
  return (
    <AdminStatus status={status}>
      <AdminHead title="Overview" />
      <AdminHeader
        title="Overview"
        range={range}
        from={from}
        to={to}
        note={
          data
            ? `UTC days ${data.range?.from || ''} to ${data.range?.to || ''}. Verified activation from ${data.verifiedFrom}. Test emails ending in @parle.test are excluded.`
            : ''
        }
      />
      {!data?.available ? (
        <Unavailable message="Analytics schema is not available in this environment." />
      ) : (
        <>
          <div className="admin-kpis">
            <AdminKpi label="Registered" value={data.registered} hint="All-time, excluding test accounts" />
            <AdminKpi label="New accounts" value={data.newAccounts} hint={`${range}-day range`} />
            <AdminKpi
              label="Active (sent a message)"
              value={data.active}
              hint="Distinct authenticated users"
            />
            <AdminKpi
              label="Messages"
              value={(data.messages?.authed || 0) + (data.messages?.guest || 0)}
              hint={`${data.messages?.authed || 0} authed · ${data.messages?.guest || 0} guest`}
            />
            <AdminKpi label="Conversations started" value={data.conversations} />
            <AdminKpi
              label="Thumbs"
              value={`${data.thumbs?.up || 0} / ${data.thumbs?.down || 0}`}
              hint={`${formatPct(data.thumbs?.up || 0, data.thumbs?.total || 0)} up of ${data.thumbs?.total || 0}`}
            />
          </div>
          <div className="admin-panel">
            <h2>Daily messages and conversations</h2>
            <AdminBarChart
              rows={data.daily}
              series={[
                { key: 'authed_messages', label: 'Authed messages', color: '#c54b44' },
                { key: 'guest_messages', label: 'Guest messages', color: '#8a6a62' },
                { key: 'conversations', label: 'Conversations started', color: '#e8c4a8' },
              ]}
            />
          </div>
          <div className="admin-panel">
            <h2>New registrations</h2>
            <AdminBarChart
              rows={data.signups}
              xKey="day"
              series={[{ key: 'n', label: 'Sign-ups', color: '#c54b44' }]}
            />
          </div>
          <div className="admin-panel">
            <h2>Mode mix (messages)</h2>
            <AdminHBar rows={data.modes} />
          </div>
        </>
      )}
    </AdminStatus>
  )
}
