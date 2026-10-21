import Link from 'next/link'
import { AdminHead, AdminHeader, AdminStatus, Unavailable } from '../../../components/admin/AdminGate'
import { requireAdminGssp } from '../../../lib/parle/adminPage'
import { useAdminQuery } from '../../../lib/parle/useAdminQuery'

export const getServerSideProps = requireAdminGssp

function fmt(value) {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 16)
}

export default function AdminUsersPage() {
  const { status, data, search, page, router } = useAdminQuery('/api/admin/users')
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || 25)))
  return (
    <AdminStatus status={status}>
      <AdminHead title="Users" />
      <AdminHeader
        title="Users"
        note="Usage only. Transcripts, journals, living profiles and credentials are not available here."
      />
      <form
        className="admin-search"
        onSubmit={(event) => {
          event.preventDefault()
          const q = new FormData(event.currentTarget).get('q')
          router.push({ pathname: '/admin/users', query: { q: String(q || ''), page: 1 } })
        }}
      >
        <input name="q" defaultValue={search} placeholder="Search email or user id" />
        <button type="submit">Search</button>
      </form>
      {!data?.available ? (
        <Unavailable message="User directory is not available in this environment." />
      ) : (
        <>
          <p className="text-[12px] text-[#9a9088] mb-2">
            {data.total} registered users · page {data.page} of {totalPages}
          </p>
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Registered</th>
                  <th>Activated</th>
                  <th>Last activity</th>
                  <th>Messages</th>
                  <th>Conversations</th>
                </tr>
              </thead>
              <tbody>
                {(data.users || []).map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link href={`/admin/users/${user.id}`}>{user.email}</Link>
                    </td>
                    <td>{fmt(user.created_at)}</td>
                    <td>{fmt(user.first_activated_at)}</td>
                    <td>{fmt(user.last_active_at)}</td>
                    <td>{user.messages}</td>
                    <td>{user.conversations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-range mt-4">
            {data.page > 1 ? (
              <Link href={{ pathname: '/admin/users', query: { q: search, page: data.page - 1 } }}>Previous</Link>
            ) : null}
            {data.page < totalPages ? (
              <Link href={{ pathname: '/admin/users', query: { q: search, page: data.page + 1 } }}>Next</Link>
            ) : null}
          </div>
        </>
      )}
    </AdminStatus>
  )
}
