import { AdminBarChart, AdminHBar } from '../../components/admin/AdminCharts'
import { AdminHead, AdminHeader, AdminKpi, AdminStatus, Unavailable } from '../../components/admin/AdminGate'
import { requireAdminGssp } from '../../lib/parle/adminPage'
import { useAdminQuery } from '../../lib/parle/useAdminQuery'

export const getServerSideProps = requireAdminGssp

export default function AdminConversationsPage() {
  const { status, data, range, from, to } = useAdminQuery('/api/admin/conversations')
  const authedModes = (data?.modes || []).filter((row) => !row.is_guest)
  const guestModes = (data?.modes || []).filter((row) => row.is_guest)
  return (
    <AdminStatus status={status}>
      <AdminHead title="Conversations" />
      <AdminHeader
        title="Conversations"
        range={range}
        from={from}
        to={to}
        note="Started conversations come from conversation_started events. Average length uses session-end rows only and is incomplete."
      />
      {!data?.available ? (
        <Unavailable message="Conversation analytics are not available in this environment." />
      ) : (
        <>
          <div className="admin-kpis">
            <AdminKpi label="Started" value={data.totals?.conversations ?? 0} />
            <AdminKpi label="Authed messages" value={data.totals?.authedMessages ?? 0} />
            <AdminKpi label="Guest messages" value={data.totals?.guestMessages ?? 0} />
            <AdminKpi
              label="Msgs / started"
              value={data.totals?.avgMessagesPerStarted ?? 'n/a'}
              hint="Authed messages divided by conversation_started"
            />
            <AdminKpi
              label="Session-end avg msgs"
              value={data.sessionEnd?.avgMessages ?? 'n/a'}
              hint={`${data.sessionEnd?.n || 0} completed authed sessions`}
            />
            <AdminKpi
              label="Guest session avg msgs"
              value={data.guestSessions?.avgMessages ?? 'n/a'}
              hint={`${data.guestSessions?.n || 0} guest sessions`}
            />
          </div>
          <p className="text-[12px] text-[#9a9088] mt-3">{data.sessionEnd?.note}</p>
          <div className="admin-panel">
            <h2>Volume by day</h2>
            <AdminBarChart
              rows={data.daily}
              series={[
                { key: 'authed_messages', label: 'Authed messages', color: '#c54b44' },
                { key: 'guest_messages', label: 'Guest messages', color: '#8a6a62' },
                { key: 'conversations', label: 'Started', color: '#e8c4a8' },
              ]}
            />
          </div>
          <div className="admin-panel">
            <h2>Authenticated modes</h2>
            <AdminHBar rows={authedModes} />
          </div>
          <div className="admin-panel">
            <h2>Guest modes</h2>
            <AdminHBar rows={guestModes} />
          </div>
        </>
      )}
    </AdminStatus>
  )
}
