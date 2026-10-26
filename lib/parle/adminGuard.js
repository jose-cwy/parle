const { runApiPipeline } = require('../security/pipeline')
const { requireAdminUser } = require('./adminAuth')

async function guardAdminApi(req, res) {
  const pipeline = await runApiPipeline(req, res, { requireAuth: true, tier: 'default' })
  if (pipeline.handled) return null
  const admin = await requireAdminUser(pipeline.payload)
  if (!admin.ok) {
    res.status(404).end()
    return null
  }
  console.info('admin_access', {
    route: req.url?.split('?')[0] || null,
    adminUserId: admin.user.id,
  })
  return admin
}

module.exports = {
  guardAdminApi,
}
