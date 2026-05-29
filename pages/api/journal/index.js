import { getTokenFromReq, verifyToken } from '../../../lib/auth'
import { getClientTodayFromReq } from '../../../lib/journalClientDate'
import {
  createJournalEntry,
  findEntryForDate,
  listJournalEntries,
} from '../../../lib/journalDb'

function dbErrorResponse(res, error, context) {
  console.error(`${context}_error`, error)
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
  const token = getTokenFromReq(req)
  const payload = verifyToken(token)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  const clientToday = getClientTodayFromReq(req)

  try {
    if (req.method === 'GET') {
      const rows = await listJournalEntries(payload.id)
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const { content } = req.body || {}
      if (!content || !String(content).trim()) {
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
