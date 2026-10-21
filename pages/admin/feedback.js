import { AdminBarChart, AdminHBar, formatPct } from '../../components/admin/AdminCharts'
import { AdminHead, AdminHeader, AdminKpi, AdminStatus, Unavailable } from '../../components/admin/AdminGate'
import { requireAdminGssp } from '../../lib/parle/adminPage'
import { useAdminQuery } from '../../lib/parle/useAdminQuery'

export const getServerSideProps = requireAdminGssp

function outcomeRows(outcome) {
  return Object.entries(outcome?.options || {}).map(([mode_id, n]) => ({ mode_id, n }))
}

export default function AdminFeedbackPage() {
  const { status, data, range, from, to } = useAdminQuery('/api/admin/feedback')
  const reasonRows = Object.entries(data?.thumbs?.reasons || {}).map(([mode_id, n]) => ({ mode_id, n }))
  return (
    <AdminStatus status={status}>
      <AdminHead title="Feedback" />
      <AdminHeader
        title="Feedback & impact"
        range={range}
        from={from}
        to={to}
        note="Relief and clarity are aggregate post-chat surveys. Individual emotional outcomes are not shown on user profiles."
      />
      {!data?.available ? (
        <Unavailable message="Feedback tables are not available in this environment." />
      ) : (
        <>
          <div className="admin-kpis">
            <AdminKpi
              label="Relief answered"
              value={`${data.relief?.answered || 0} / ${data.relief?.shown || 0}`}
              hint={`${formatPct(data.relief?.answered || 0, data.relief?.shown || 0)} of shown · ${data.relief?.skipped || 0} skipped`}
            />
            <AdminKpi
              label="Clarity answered"
              value={`${data.clarity?.answered || 0} / ${data.clarity?.shown || 0}`}
              hint={`${formatPct(data.clarity?.answered || 0, data.clarity?.shown || 0)} of shown · ${data.clarity?.skipped || 0} skipped`}
            />
            <AdminKpi
              label="Thumbs up"
              value={data.thumbs?.up || 0}
              hint={`${formatPct(data.thumbs?.up || 0, data.thumbs?.total || 0)} of ${data.thumbs?.total || 0}`}
            />
            <AdminKpi
              label="Thumbs down"
              value={data.thumbs?.down || 0}
              hint={`${formatPct(data.thumbs?.down || 0, data.thumbs?.total || 0)} of ${data.thumbs?.total || 0}`}
            />
          </div>
          <div className="admin-panel">
            <h2>Thumbs by day</h2>
            <AdminBarChart
              rows={data.daily}
              series={[
                { key: 'up', label: 'Up', color: '#c54b44' },
                { key: 'down', label: 'Down', color: '#8a6a62' },
              ]}
            />
          </div>
          <div className="admin-panel">
            <h2>Relief answers</h2>
            <AdminHBar rows={outcomeRows(data.relief)} />
          </div>
          <div className="admin-panel">
            <h2>Clarity answers</h2>
            <AdminHBar rows={outcomeRows(data.clarity)} />
          </div>
          <div className="admin-panel">
            <h2>Downvote reasons</h2>
            <AdminHBar rows={reasonRows} />
          </div>
        </>
      )}
    </AdminStatus>
  )
}
