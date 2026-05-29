/**
 * Journal persistence — reads/writes the `diary` table (legacy DB name).
 */
const db = require('./db')

function formatLocalDateKey(value) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseCalendarDate(value) {
  if (value == null) return null
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
  }
  return formatLocalDateKey(value)
}

/** @type {boolean | null} */
let entryDateColumn = null

async function hasEntryDateColumn() {
  if (entryDateColumn !== null) return entryDateColumn
  try {
    const r = await db.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'diary' AND column_name = 'entry_date'
       LIMIT 1`,
    )
    entryDateColumn = r.rows.length > 0
  } catch {
    entryDateColumn = false
  }
  return entryDateColumn
}

function serializeJournalRow(row) {
  if (!row) return row
  const out = {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    entry_date: row.entry_date != null ? parseCalendarDate(row.entry_date) : null,
  }
  if (row.user_id != null) out.user_id = row.user_id
  return out
}

async function listJournalEntries(userId) {
  if (await hasEntryDateColumn()) {
    const r = await db.query(
      'SELECT id, content, entry_date, created_at FROM diary WHERE user_id = $1 ORDER BY entry_date DESC NULLS LAST, created_at DESC',
      [userId],
    )
    return r.rows.map(serializeJournalRow)
  }
  const r = await db.query(
    'SELECT id, content, created_at FROM diary WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  )
  return r.rows.map((row) => serializeJournalRow({ ...row, entry_date: null }))
}

async function findEntryForDate(userId, dateKey) {
  if (await hasEntryDateColumn()) {
    const r = await db.query(
      'SELECT id, entry_date, created_at FROM diary WHERE user_id = $1',
      [userId],
    )
    const match = r.rows.find((row) => {
      const fromDate = parseCalendarDate(row.entry_date)
      const fromCreated = formatLocalDateKey(row.created_at)
      return fromDate === dateKey || fromCreated === dateKey
    })
    return match ? { id: match.id } : null
  }
  const r = await db.query(
    'SELECT id, created_at FROM diary WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  )
  return r.rows.find((row) => formatLocalDateKey(row.created_at) === dateKey) || null
}

async function createJournalEntry(userId, content, dateKey) {
  const now = new Date()
  const trimmed = String(content).trim()
  if (await hasEntryDateColumn()) {
    const r = await db.query(
      `INSERT INTO diary (user_id, content, entry_date, created_at)
       VALUES ($1, $2, $3::date, $4)
       RETURNING id, content, entry_date, created_at`,
      [userId, trimmed, dateKey, now],
    )
    return serializeJournalRow(r.rows[0])
  }
  const r = await db.query(
    `INSERT INTO diary (user_id, content, created_at)
     VALUES ($1, $2, $3)
     RETURNING id, content, created_at`,
    [userId, trimmed, now],
  )
  return serializeJournalRow({ ...r.rows[0], entry_date: dateKey })
}

async function getJournalEntryById(id) {
  if (await hasEntryDateColumn()) {
    const r = await db.query(
      'SELECT id, user_id, content, entry_date, created_at FROM diary WHERE id = $1',
      [id],
    )
    return serializeJournalRow(r.rows[0]) || null
  }
  const r = await db.query(
    'SELECT id, user_id, content, created_at FROM diary WHERE id = $1',
    [id],
  )
  const row = r.rows[0]
  if (!row) return null
  return serializeJournalRow({ ...row, entry_date: null })
}

async function updateJournalEntry(id, content, dateKey = null) {
  const trimmed = String(content).trim()
  if (await hasEntryDateColumn()) {
    const r = dateKey
      ? await db.query(
          'UPDATE diary SET content = $1, entry_date = $2::date WHERE id = $3 RETURNING id, content, entry_date, created_at',
          [trimmed, dateKey, id],
        )
      : await db.query(
          'UPDATE diary SET content = $1 WHERE id = $2 RETURNING id, content, entry_date, created_at',
          [trimmed, id],
        )
    return serializeJournalRow(r.rows[0])
  }
  const r = await db.query(
    'UPDATE diary SET content = $1 WHERE id = $2 RETURNING id, content, created_at',
    [trimmed, id],
  )
  return serializeJournalRow({ ...r.rows[0], entry_date: null })
}

async function deleteJournalEntry(id) {
  await db.query('DELETE FROM diary WHERE id = $1', [id])
}

module.exports = {
  hasEntryDateColumn,
  listJournalEntries,
  findEntryForDate,
  createJournalEntry,
  getJournalEntryById,
  updateJournalEntry,
  deleteJournalEntry,
}
