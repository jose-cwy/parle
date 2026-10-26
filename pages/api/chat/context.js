import db from '../../../lib/db'
import { getUserChatSettings } from '../../../lib/parle/preferences'
import { updateUserSettings } from '../../../lib/parle/userSettings'
import { runApiPipeline } from '../../../lib/security/pipeline'

let consentColumnReady = null

async function ensureImageAttachConsentColumn() {
  if (!consentColumnReady) {
    consentColumnReady = db
      .query('ALTER TABLE users ADD COLUMN IF NOT EXISTS image_attach_consent_at TIMESTAMPTZ')
      .catch((error) => {
        console.error('image_attach_consent_schema_error', error?.message)
      })
  }
  return consentColumnReady
}

export default async function handler(req, res) {
  const guard = await runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return
  const payload = guard.payload

  if (req.method === 'GET') {
    try {
      await ensureImageAttachConsentColumn()
      const settings = await getUserChatSettings(payload.id)
      let imageAttachConsent = false
      let onboardingAnswered = false
      let onboardingReason = null
      try {
        const consentRow = await db.query(
          'SELECT image_attach_consent_at, onboarding_answered, onboarding_reason FROM users WHERE id = $1',
          [payload.id],
        )
        imageAttachConsent = Boolean(consentRow.rows[0]?.image_attach_consent_at)
        onboardingAnswered = Boolean(consentRow.rows[0]?.onboarding_answered)
        onboardingReason = consentRow.rows[0]?.onboarding_reason || null
      } catch {
        imageAttachConsent = false
        onboardingAnswered = false
        onboardingReason = null
      }
      return res.status(200).json({
        memory_enabled: settings.memory_enabled,
        personalisation_enabled: settings.personalisation_enabled,
        has_last_session_summary: Boolean(settings.has_last_session_summary),
        image_attach_consent: imageAttachConsent,
        onboarding_answered: onboardingAnswered,
        onboarding_reason: onboardingReason,
      })
    } catch (error) {
      if (error?.code === '42P01' || error?.code === '42703') {
        return res.status(200).json({
          memory_enabled: true,
          personalisation_enabled: true,
          has_last_session_summary: false,
          onboarding_answered: false,
          onboarding_reason: null,
        })
      }
      console.error('chat_context_error', error)
      return res.status(500).json({ error: 'Unable to load chat context' })
    }
  }

  if (req.method === 'PATCH') {
    const { memory_enabled, personalisation_enabled, image_attach_consent } =
      req.body || {}

    const privacyPatch = {}
    if (typeof memory_enabled === 'boolean') privacyPatch.memory_enabled = memory_enabled
    if (typeof personalisation_enabled === 'boolean') {
      privacyPatch.personalisation_enabled = personalisation_enabled
    }

    if (Object.keys(privacyPatch).length) {
      try {
        const updated = await updateUserSettings(payload.id, privacyPatch)
        if (image_attach_consent === true) {
          try {
            await ensureImageAttachConsentColumn()
            await db.query(
              'UPDATE users SET image_attach_consent_at = now() WHERE id = $1',
              [payload.id],
            )
          } catch (error) {
            if (error?.code !== '42703') throw error
          }
        }
        return res.status(200).json({
          ...updated,
          image_attach_consent: image_attach_consent === true ? true : undefined,
        })
      } catch (error) {
        if (error?.statusCode === 400) {
          return res.status(400).json({ error: error.message })
        }
        if (error?.code === '42703' || error?.statusCode === 503) {
          return res.status(503).json({ error: 'Database migration required' })
        }
        console.error('privacy_toggle_error', error)
        return res.status(500).json({ error: 'Unable to update setting' })
      }
    }

    if (image_attach_consent === true) {
      try {
        await ensureImageAttachConsentColumn()
        await db.query(
          'UPDATE users SET image_attach_consent_at = now() WHERE id = $1',
          [payload.id],
        )
      } catch (error) {
        if (error?.code === '42703') {
          return res.status(200).json({ image_attach_consent: true, stored: false })
        }
        console.error('image_consent_error', error)
        return res.status(500).json({ error: 'Unable to save consent' })
      }
      return res.status(200).json({ image_attach_consent: true })
    }

    return res.status(400).json({ error: 'No valid fields to update' })
  }

  return res.status(405).end()
}
