const db = require('../db')
const { analyticsVerifiedFrom } = require('./metricsExclude')

function excludeSql(alias = 'u') {
  return `(${alias}.email IS NULL OR (${alias}.email NOT ILIKE '%@parle.test' AND NOT (${alias}.email = ANY($1))))`
}

function parseExcludeEmails(env = process.env) {
  const list = String(env.METRICS_EXCLUDE_EMAILS || '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  return list.length ? list : ['']
}

function emptyInsights(extra = {}) {
  return {
    available: true,
    timezone: 'UTC',
    verifiedFrom: analyticsVerifiedFrom(),
    autoDeletionImplemented: false,
    analyticsRetentionNote:
      'Product events are intended to be kept for 24 months. Automatic deletion is not implemented yet.',
    dau: { n: 0, rangeDays: 1 },
    newActivated: { n: 0, estimatedN: 0, verifiedN: 0 },
    d1: { pending: true, n: 0, d: 0, pct: null, kind: 'pending' },
    d7: { pending: true, n: 0, d: 0, pct: null, kind: 'pending' },
    relief: { eligible: 0, shown: 0, skipped: 0, answered: 0, options: {} },
    clarity: { eligible: 0, shown: 0, skipped: 0, answered: 0, options: {} },
    thumbs: { up: 0, down: 0, total: 0, reasons: {} },
    modes: [],
    guest: { messages: 0 },
    ...extra,
  }
}

function pct(n, d) {
  if (!d) return null
  return Math.round((n / d) * 1000) / 10
}

async function loadInsights(env = process.env) {
  const exclude = parseExcludeEmails(env)
  const verifiedFrom = analyticsVerifiedFrom(env)
  const params = [exclude]

  try {
    const dau = await db.query(
      `SELECT COUNT(DISTINCT e.user_id)::int AS n
       FROM product_events e
       JOIN users u ON u.id = e.user_id
       WHERE e.name = 'message_sent'
         AND e.user_id IS NOT NULL
         AND (e.created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
         AND ${excludeSql('u')}`,
      params,
    )

    const activated = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE u.first_activated_at IS NOT NULL)::int AS n,
         COUNT(*) FILTER (
           WHERE u.first_activated_at IS NOT NULL
             AND (u.first_activated_at AT TIME ZONE 'UTC')::date >= $2::date
         )::int AS verified_n,
         COUNT(*) FILTER (
           WHERE u.first_activated_at IS NOT NULL
             AND (u.first_activated_at AT TIME ZONE 'UTC')::date < $2::date
         )::int AS estimated_n
       FROM users u
       WHERE ${excludeSql('u')}`,
      [exclude, verifiedFrom],
    )

    const d1 = await retentionRow(exclude, verifiedFrom, 1)
    const d7 = await retentionRow(exclude, verifiedFrom, 7)

    const outcomes = await db.query(
      `SELECT dimension, response, COUNT(*)::int AS n
       FROM product_feedback pf
       LEFT JOIN users u ON u.id = pf.user_id
       WHERE pf.dimension IN ('relief', 'clarity')
         AND (pf.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY dimension, response`,
      params,
    )

    const survey = await db.query(
      `SELECT e.name, e.dimension, COUNT(*)::int AS n
       FROM product_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.name IN ('survey_shown', 'survey_skipped')
         AND (e.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY e.name, e.dimension`,
      params,
    )

    const thumbs = await db.query(
      `SELECT rating, reason, COUNT(*)::int AS n
       FROM message_feedback mf
       LEFT JOIN users u ON u.id = mf.user_id
       WHERE mf.user_id IS NULL OR ${excludeSql('u')}
       GROUP BY rating, reason`,
      params,
    )

    const modes = await db.query(
      `SELECT COALESCE(e.mode_id, 'unknown') AS mode_id, COUNT(*)::int AS n
       FROM product_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.name = 'message_sent'
         AND (e.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY 1
       ORDER BY n DESC`,
      params,
    )

    const guest = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM product_events
       WHERE name = 'message_sent' AND is_guest = TRUE`,
    )

    const relief = summarizeOutcome('relief', outcomes.rows, survey.rows)
    const clarity = summarizeOutcome('clarity', outcomes.rows, survey.rows)

    const thumbSummary = { up: 0, down: 0, total: 0, reasons: {} }
    for (const row of thumbs.rows) {
      if (row.rating === 'up') thumbSummary.up += row.n
      if (row.rating === 'down') {
        thumbSummary.down += row.n
        if (row.reason) thumbSummary.reasons[row.reason] = row.n
      }
      thumbSummary.total += row.n
    }

    return {
      ...emptyInsights({ verifiedFrom }),
      dau: { n: dau.rows[0]?.n || 0, rangeDays: 1, label: `${dau.rows[0]?.n || 0} / today` },
      newActivated: {
        n: activated.rows[0]?.n || 0,
        verifiedN: activated.rows[0]?.verified_n || 0,
        estimatedN: activated.rows[0]?.estimated_n || 0,
      },
      d1,
      d7,
      relief,
      clarity,
      thumbs: thumbSummary,
      modes: modes.rows,
      guest: { messages: guest.rows[0]?.n || 0 },
    }
  } catch (error) {
    if (error?.code === '42P01' || error?.code === '42703') {
      return emptyInsights({ available: false, schemaReady: false })
    }
    throw error
  }
}

async function retentionRow(exclude, verifiedFrom, days) {
  const result = await db.query(
    `WITH cohorts AS (
       SELECT u.id, (u.first_activated_at AT TIME ZONE 'UTC')::date AS cohort_date
       FROM users u
       WHERE u.first_activated_at IS NOT NULL
         AND (u.first_activated_at AT TIME ZONE 'UTC')::date >= $2::date
         AND ${excludeSql('u')}
     ),
     matured AS (
       SELECT *
       FROM cohorts
       WHERE cohort_date <= ((now() AT TIME ZONE 'UTC')::date - $3::int)
     ),
     returned AS (
       SELECT DISTINCT m.id
       FROM matured m
       JOIN product_events e ON e.user_id = m.id
         AND e.name = 'message_sent'
         AND (e.created_at AT TIME ZONE 'UTC')::date = m.cohort_date + $3::int
     )
     SELECT
       (SELECT COUNT(*)::int FROM matured) AS d,
       (SELECT COUNT(*)::int FROM returned) AS n,
       (SELECT COUNT(*)::int FROM cohorts) AS cohort_n,
       (SELECT COUNT(*)::int FROM cohorts WHERE cohort_date > ((now() AT TIME ZONE 'UTC')::date - $3::int)) AS pending_n
    `,
    [exclude, verifiedFrom, days],
  )
  const row = result.rows[0] || {}
  const d = row.d || 0
  const n = row.n || 0
  if (!d) {
    return {
      n: 0,
      d: 0,
      pct: null,
      pending: (row.pending_n || 0) > 0,
      kind: (row.pending_n || 0) > 0 ? 'pending' : 'empty',
      pendingN: row.pending_n || 0,
      cohortN: row.cohort_n || 0,
      verified: true,
    }
  }
  return {
    n,
    d,
    pct: pct(n, d),
    pending: false,
    kind: 'matured',
    pendingN: row.pending_n || 0,
    cohortN: row.cohort_n || 0,
    verified: true,
  }
}

function summarizeOutcome(dimension, outcomeRows, surveyRows) {
  const options = {}
  let answered = 0
  for (const row of outcomeRows) {
    if (row.dimension !== dimension) continue
    options[row.response] = row.n
    answered += row.n
  }
  const shown = surveyRows
    .filter((row) => row.name === 'survey_shown')
    .reduce((sum, row) => sum + row.n, 0)
  const skipped = surveyRows
    .filter((row) => row.name === 'survey_skipped' && (row.dimension === dimension || row.dimension === 'all'))
    .reduce((sum, row) => sum + row.n, 0)
  return {
    eligible: shown,
    shown,
    skipped,
    answered,
    options,
  }
}

module.exports = {
  loadInsights,
  emptyInsights,
  pct,
  summarizeOutcome,
}
