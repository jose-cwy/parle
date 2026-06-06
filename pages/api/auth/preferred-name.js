import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import db from '../../../lib/db'
import { normalizePreferredName } from '../../../lib/user'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = getTokenFromReq(req)
  if (!token) return res.status(401).json({ error: 'Not signed in' })

  const payload = verifyToken(token)
  if (!payload?.id) return res.status(401).json({ error: 'Not signed in' })

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
    console.error('preferred_name_error', error)
    return res.status(500).json({ error: 'Unable to save your name right now. Please try again.' })
  }
}
