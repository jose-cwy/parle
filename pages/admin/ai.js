import { AdminHead, AdminHeader, AdminKpi, AdminStatus } from '../../components/admin/AdminGate'
import { requireAdminGssp } from '../../lib/parle/adminPage'
import { useAdminQuery } from '../../lib/parle/useAdminQuery'

export const getServerSideProps = requireAdminGssp

function Metric({ title, metric }) {
  return (
    <div className="admin-panel">
      <h2>{title}</h2>
      <p className="admin-unavailable">
        Status: {metric?.status || 'not_recorded'}. {metric?.note}
      </p>
    </div>
  )
}

export default function AdminAiPage() {
  const { status, data } = useAdminQuery('/api/admin/ops')
  const ai = data?.ai
  return (
    <AdminStatus status={status}>
      <AdminHead title="AI Performance" />
      <AdminHeader
        title="AI Performance"
        note="Latency, error rates and cost are not stored. This page reports configuration only and will not invent numbers."
      />
      <div className="admin-kpis">
        <AdminKpi label="Configured model" value={ai?.configuredModel || 'not set'} />
        <AdminKpi label="Hidden think" value={ai?.hiddenThink ? 'on' : 'off'} />
      </div>
      <Metric title="Latency" metric={ai?.latency} />
      <Metric title="Errors and rate limits" metric={ai?.errors} />
      <Metric title="Cost" metric={ai?.cost} />
    </AdminStatus>
  )
}
