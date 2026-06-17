import { runApiPipeline } from '../../../lib/security/pipeline'
import { sanitizeJournalContent } from '../../../lib/security/sanitize'
import { assertEncryptionConfigured, mapEncryptionError } from '../../../lib/security/encryption'
import { getClientTodayFromReq } from '../../../lib/journalClientDate'
import {
  createJournalEntry,
  findEntryForDate,
  listJournalEntries,
} from '../../../lib/journalDb'

function dbErrorResponse(res, error, context) {
  console.error(`${context}_error`, error?.code || error?.message || error)
  if (error?.message === 'EMPTY_JOURNAL') {
    return res.status(400).json({ error: 'Write something before saving your entry.' })
  }
  const encryptionError = mapEncryptionError(error)
  if (encryptionError) {
    return res.status(503).json({ error: encryptionError })
  }
  if (error?.code === '42P01') {
    return res.status(500).json({ error: 'Database schema is not installed. Apply database/schema.sql.' })
  }
  if (error?.code === '23505') {
    return res.status(409).json({
      error: "You already have today's page. Update it instead of creating another.",
      code: 'JOURNAL_EXISTS',
    })
  }
  return res.status(500).json({ error: 'Unable to save journal entries right now. Please try again.' })
}

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return
  const payload = guard.payload

  const clientToday = getClientTodayFromReq(req)

  try {
    assertEncryptionConfigured()

    if (req.method === 'GET') {
      const rows = await listJournalEntries(payload.id)
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const content = sanitizeJournalContent(req.body?.content)
      if (!content) {
        return res.status(400).json({ error: 'Write something before saving your entry.' })
      }

      const existing = await findEntryForDate(payload.id, clientToday)
      if (existing) {
        return res.status(409).json({
          error: "You already have today's page. Update it instead of creating another.",
          code: 'JOURNAL_EXISTS',
          id: existing.id,
        })
      }

      const row = await createJournalEntry(payload.id, content, clientToday)
      return res.status(201).json(row)
    }

    return res.status(405).end()
  } catch (error) {
    return dbErrorResponse(res, error, 'journal_index')
  }
}
