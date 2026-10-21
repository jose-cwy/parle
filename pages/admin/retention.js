import { AdminBarChart, formatPct } from '../../components/admin/AdminCharts'
import { AdminHead, AdminHeader, AdminKpi, AdminStatus, Unavailable } from '../../components/admin/AdminGate'
import { requireAdminGssp } from '../../lib/parle/adminPage'
import { useAdminQuery } from '../../lib/parle/useAdminQuery'

export const getServerSideProps = requireAdminGssp

function RetentionLine({ label, row }) {
  if (!row) return null
  if (row.kind === 'pending' || row.pending) {
    return (
      <p className="text-sm">
        <strong>{label}:</strong> pending ({row.n} / {row.d} matured; cohort still open)
      </p>
    )
  }
  if (row.kind === 'empty' || (!row.d && !row.n)) {
    return (
      <p className="text-sm">
        <strong>{label}:</strong> no matured cohort yet
      </p>
    )
  }
  return (
    <p className="text-sm">
      <strong>{label}:</strong> {row.n} / {row.d} ({formatPct(row.n, row.d)})
    </p>
  )
}

export default function AdminRetentionPage() {
  const { status, data } = useAdminQuery('/api/admin/retention')
  return (
    <AdminStatus status={status}>
      <AdminHead title="Retention" />
      <AdminHeader
        title="Retention"
        note={
          data
            ? `UTC. Verified retention uses authenticated sends from ${data.verifiedFrom}. Historical activation before that date is estimated.`
            : ''
        }
      />
      {!data?.available ? (
        <Unavailable message="Retention metrics are not available in this environment." />
      ) : (
        <>
          <div className="admin-kpis">
            <AdminKpi label="Activated" value={data.newActivated?.n || 0} hint={`${data.newActivated?.verifiedN || 0} verified · ${data.newActivated?.estimatedN || 0} estimated`} />
            <AdminKpi label="Returning users" value={data.returningUsers || 0} hint="Sent messages on 2+ distinct UTC days" />
            <AdminKpi
              label="D1"
              value={data.d1?.kind === 'pending' ? 'pending' : formatPct(data.d1?.n, data.d1?.d)}
              hint={`${data.d1?.n || 0} / ${data.d1?.d || 0}`}
            />
            <AdminKpi
              label="D7"
              value={data.d7?.kind === 'pending' ? 'pending' : formatPct(data.d7?.n, data.d7?.d)}
              hint={`${data.d7?.n || 0} / ${data.d7?.d || 0}`}
            />
          </div>
          <div className="admin-panel space-y-2">
            <RetentionLine label="Day-1 retention" row={data.d1} />
            <RetentionLine label="Day-7 retention" row={data.d7} />
          </div>
          <div className="admin-panel">
            <h2>Verified activation cohorts</h2>
            <AdminBarChart
              rows={data.verifiedCohorts}
              series={[{ key: 'n', label: 'Activated users', color: '#c54b44' }]}
            />
          </div>
        </>
      )}
    </AdminStatus>
  )
}
