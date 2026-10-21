import { requireAdminGssp } from '../../lib/parle/adminPage'

export async function getServerSideProps(ctx) {
  const gated = await requireAdminGssp(ctx)
  if (gated.notFound) return gated
  return {
    redirect: {
      destination: '/admin',
      permanent: false,
    },
  }
}

export default function AdminInsightsRedirect() {
  return null
}
