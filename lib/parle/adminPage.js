const { getSessionPayload } = require('../auth')
const { requireAdminUser } = require('./adminAuth')

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  )
}

async function requireAdminGssp(ctx) {
  const payload = getSessionPayload(ctx.req)
  const admin = await requireAdminUser(payload)
  if (!admin.ok) return { notFound: true }
  return {
    props: {
      viewerId: admin.user.id,
    },
  }
}

async function requireAdminUserDetailGssp(ctx) {
  const gated = await requireAdminGssp(ctx)
  if (gated.notFound) return gated
  const id = ctx.params?.id
  if (!isUuid(id)) return { notFound: true }
  return {
    props: {
      ...gated.props,
      userId: id,
    },
  }
}

module.exports = {
  isUuid,
  requireAdminGssp,
  requireAdminUserDetailGssp,
}
