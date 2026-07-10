import db from '../../../lib/db'
import { isValidOnboardingReason } from '../../../lib/parle/onboarding'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'

let schemaReady = null

async function ensureOnboardingSchema() {
  if (!schemaReady) {
    schemaReady = db
      .query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_reason VARCHAR(32);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_answered BOOLEAN NOT NULL DEFAULT FALSE;
      `)
      .catch(() => {})
  }
  return schemaReady
}

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'settings' })
  if (guard.handled) return
  const payload = guard.payload

  if (req.method !== 'PATCH') {
    return res.status(405).end()
  }

  const { reason } = req.body || {}
  if (!isValidOnboardingReason(reason)) {
    return res.status(400).json({ error: 'Invalid onboarding reason' })
  }

  try {
    await ensureOnboardingSchema()
    await db.query(
      `UPDATE users
       SET onboarding_reason = $1, onboarding_answered = TRUE
       WHERE id = $2`,
      [reason, payload.id],
    )
    return res.status(200).json({
      onboarding_answered: true,
      onboarding_reason: reason,
    })
  } catch (error) {
    return handleApiError(res, error, 'user_onboarding')
  }
}
