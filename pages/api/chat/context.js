import db from '../../../lib/db'
import { getUserChatSettings } from '../../../lib/parle/preferences'
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
        last_session_summary: settings.last_session_summary,
        profile: settings.profile,
        image_attach_consent: imageAttachConsent,
      })
    } catch (error) {
      if (error?.code === '42P01' || error?.code === '42703') {
        return res.status(200).json({
          memory_enabled: false,
          last_session_summary: null,
          profile: null,
        })
      }
      console.error('chat_context_error', error)
      return res.status(500).json({ error: 'Unable to load chat context' })
    }
  }

  if (req.method === 'PATCH') {
    const { memory_enabled, image_attach_consent } = req.body || {}

    if (typeof memory_enabled === 'boolean') {
      try {
        await db.query('UPDATE users SET memory_enabled = $1 WHERE id = $2', [
          memory_enabled,
          payload.id,
        ])
      } catch (error) {
        if (error?.code === '42703') {
          return res.status(503).json({ error: 'Database migration required' })
        }
        console.error('memory_toggle_error', error)
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

    if (typeof memory_enabled === 'boolean') {
      return res.status(200).json({ memory_enabled })
    }

    return res.status(400).json({ error: 'No valid fields to update' })
  }

  return res.status(405).end()
}
