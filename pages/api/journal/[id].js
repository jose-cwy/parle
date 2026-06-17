import { runApiPipeline } from '../../../lib/security/pipeline'
import { sanitizeJournalContent } from '../../../lib/security/sanitize'
import { assertEncryptionConfigured, mapEncryptionError } from '../../../lib/security/encryption'
import { isRowEditableOnClient } from '../../../lib/journal'
import { getClientTodayFromReq } from '../../../lib/journalClientDate'
import {
  deleteJournalEntry,
  getJournalEntryById,
  updateJournalEntry,
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
  return res.status(500).json({ error: 'Unable to update journal entry right now. Please try again.' })
}

export default async function handler(req, res) {
  const guard = runApiPipeline(req, res, { requireAuth: true })
  if (guard.handled) return
  const payload = guard.payload

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Missing entry id' })

  const clientToday = getClientTodayFromReq(req)

  try {
    assertEncryptionConfigured()

    const row = await getJournalEntryById(id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    if (row.user_id !== payload.id) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') return res.status(200).json(row)

    if (!isRowEditableOnClient(row, clientToday)) {
      return res.status(403).json({
        error: "Past entries are kept as they were. You can only edit today's page.",
      })
    }

    if (req.method === 'PUT') {
      const content = sanitizeJournalContent(req.body?.content)
      if (!content) {
        return res.status(400).json({ error: 'Write something before saving your entry.' })
      }

      const updated = await updateJournalEntry(id, payload.id, content, clientToday)
      return res.status(200).json(updated)
    }

    if (req.method === 'DELETE') {
      await deleteJournalEntry(id, payload.id)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).end()
  } catch (error) {
    return dbErrorResponse(res, error, 'journal_id')
  }
}
