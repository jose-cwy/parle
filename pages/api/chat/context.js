import db from '../../../lib/db'
import { getUserChatSettings } from '../../../lib/parle/preferences'
import { updateUserSettings } from '../../../lib/parle/userSettings'
import { runApiPipeline } from '../../../lib/security/pipeline'

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true, tier: 'chat' })
  if (guard.handled) return
  const payload = guard.payload

  if (req.method === 'GET') {
    try {
      const settings = await getUserChatSettings(payload.id)
      let imageAttachConsent = false
      try {
        const consentRow = await db.query(
          'SELECT image_attach_consent_at FROM users WHERE id = $1',
          [payload.id],
        )
        imageAttachConsent = Boolean(consentRow.rows[0]?.image_attach_consent_at)
      } catch {
        imageAttachConsent = false
      }
      return res.status(200).json({
        memory_enabled: settings.memory_enabled,
        personalisation_enabled: settings.personalisation_enabled,
        last_session_summary: settings.last_session_summary,
        profile: settings.profile,
        image_attach_consent: imageAttachConsent,
      })
    } catch (error) {
      if (error?.code === '42P01' || error?.code === '42703') {
        return res.status(200).json({
          memory_enabled: false,
          personalisation_enabled: false,
          last_session_summary: null,
          profile: null,
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
