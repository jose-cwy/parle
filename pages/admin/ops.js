import { AdminHead, AdminHeader, AdminKpi, AdminStatus } from '../../components/admin/AdminGate'
import { requireAdminGssp } from '../../lib/parle/adminPage'
import { useAdminQuery } from '../../lib/parle/useAdminQuery'

export const getServerSideProps = requireAdminGssp

export default function AdminOpsPage() {
  const { status, data } = useAdminQuery('/api/admin/ops')
  return (
    <AdminStatus status={status}>
      <AdminHead title="Administration" />
      <AdminHeader
        title="Administration"
        note="Operational facts only. Account suspension, deletion and impersonation are intentionally not available."
      />
      <div className="admin-kpis">
        <AdminKpi label="Timezone" value={data?.timezone || 'UTC'} />
        <AdminKpi label="Verified from" value={data?.verifiedFrom || '—'} />
        <AdminKpi label="Product events" value={data?.productEventCount ?? 'n/a'} hint={data?.productEventsReady ? 'Table present' : 'Table missing'} />
        <AdminKpi label="Admin allowlist" value={data?.adminAllowlistConfigured ? 'configured' : 'empty'} />
      </div>
      <div className="admin-panel space-y-2 text-sm leading-relaxed">
        <p>
          <strong>Test accounts:</strong> {data?.testAccountsExcluded ? 'excluded from metrics (@parle.test and METRICS_EXCLUDE_EMAILS)' : 'not excluded'}
        </p>
        <p>
          <strong>Automatic deletion:</strong> {data?.autoDeletionImplemented ? 'implemented' : 'not implemented'}
        </p>
        <p>{data?.analyticsRetentionNote}</p>
        <p>
          <strong>Model:</strong> {data?.configuredModel || 'not set in this environment'}
        </p>
        <p>
          <strong>Hidden think:</strong> {data?.hiddenThink ? 'on' : 'off'}
        </p>
      </div>
    </AdminStatus>
  )
}
