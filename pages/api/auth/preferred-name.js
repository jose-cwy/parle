import db from '../../../lib/db'
import { normalizePreferredName } from '../../../lib/user'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'auth' })
  if (guard.handled) return
  const payload = guard.payload

  const preferredName = normalizePreferredName(req.body?.preferred_name)
  if (!preferredName) {
    return res.status(400).json({ error: 'Please enter what we should call you.' })
  }

  try {
    const result = await db.query(
      `UPDATE users
       SET preferred_name = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, email, preferred_name, accepted_terms_at, accepted_terms_version, created_at`,
      [preferredName, payload.id],
    )

    if (!result.rows.length) return res.status(404).json({ error: 'Account not found' })

    return res.status(200).json({ user: result.rows[0] })
  } catch (error) {
    if (error?.code === '42703') {
      return res.status(500).json({
        error: 'Database schema is missing preferred_name. Re-apply database/schema.sql.',
      })
    }
    return handleApiError(res, error, 'preferred_name')
  }
}
