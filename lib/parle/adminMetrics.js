const db = require('../db')
const { analyticsVerifiedFrom } = require('./metricsExclude')
const {
  excludeSql,
  parseExcludeEmails,
  retentionRow,
  summarizeOutcome,
  emptyInsights,
  pct,
} = require('./insights')
const { parseAdminRange } = require('./adminRange')

const USER_LIST_FIELDS = [
  'id',
  'email',
  'created_at',
  'first_activated_at',
  'last_active_at',
  'messages',
  'conversations',
  'memory_enabled',
  'personalisation_enabled',
]

function pickUserRow(row) {
  const out = {}
  for (const key of USER_LIST_FIELDS) out[key] = row[key] ?? null
  out.messages = Number(row.messages || 0)
  out.conversations = Number(row.conversations || 0)
  out.memory_enabled = Boolean(row.memory_enabled)
  out.personalisation_enabled = Boolean(row.personalisation_enabled)
  return out
}

function schemaUnavailable(error) {
  return error?.code === '42P01' || error?.code === '42703'
}

async function loadOverview({ from, to }, env = process.env) {
  const exclude = parseExcludeEmails(env)
  const verifiedFrom = analyticsVerifiedFrom(env)
  const rangeParams = [exclude, from, to]
  try {
    const registered = await db.query(
      `SELECT COUNT(*)::int AS n FROM users u WHERE ${excludeSql('u')}`,
      [exclude],
    )
    const newAccounts = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM users u
       WHERE ${excludeSql('u')}
         AND (u.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date`,
      rangeParams,
    )
    const active = await db.query(
      `SELECT COUNT(DISTINCT e.user_id)::int AS n
       FROM product_events e
       JOIN users u ON u.id = e.user_id
       WHERE e.name = 'message_sent'
         AND e.user_id IS NOT NULL
         AND (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND ${excludeSql('u')}`,
      rangeParams,
    )
    const messages = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE e.is_guest = FALSE)::int AS authed,
         COUNT(*) FILTER (WHERE e.is_guest = TRUE)::int AS guest
       FROM product_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.name = 'message_sent'
         AND (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (e.user_id IS NULL OR ${excludeSql('u')})`,
      rangeParams,
    )
    const conversations = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM product_events e
       JOIN users u ON u.id = e.user_id
       WHERE e.name = 'conversation_started'
         AND (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND ${excludeSql('u')}`,
      rangeParams,
    )
    const thumbs = await db.query(
      `SELECT rating, COUNT(*)::int AS n
       FROM message_feedback mf
       LEFT JOIN users u ON u.id = mf.user_id
       WHERE (mf.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (mf.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY rating`,
      rangeParams,
    )
    const daily = await db.query(
      `SELECT
         (e.created_at AT TIME ZONE 'UTC')::date::text AS day,
         COUNT(*) FILTER (WHERE e.name = 'message_sent' AND e.is_guest = FALSE)::int AS authed_messages,
         COUNT(*) FILTER (WHERE e.name = 'message_sent' AND e.is_guest = TRUE)::int AS guest_messages,
         COUNT(*) FILTER (WHERE e.name = 'conversation_started')::int AS conversations
       FROM product_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.name IN ('message_sent', 'conversation_started')
         AND (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (e.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY 1
       ORDER BY 1`,
      rangeParams,
    )
    const signups = await db.query(
      `SELECT (u.created_at AT TIME ZONE 'UTC')::date::text AS day, COUNT(*)::int AS n
       FROM users u
       WHERE ${excludeSql('u')}
         AND (u.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
       GROUP BY 1
       ORDER BY 1`,
      rangeParams,
    )
    const modes = await db.query(
      `SELECT COALESCE(e.mode_id, 'unknown') AS mode_id, COUNT(*)::int AS n
       FROM product_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.name = 'message_sent'
         AND (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (e.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY 1
       ORDER BY n DESC`,
      rangeParams,
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
    const thumbSummary = { up: 0, down: 0, total: 0 }
    for (const row of thumbs.rows) {
      if (row.rating === 'up') thumbSummary.up = row.n
      if (row.rating === 'down') thumbSummary.down = row.n
      thumbSummary.total += row.n
    }
    return {
      available: true,
      timezone: 'UTC',
      verifiedFrom,
      autoDeletionImplemented: false,
      registered: registered.rows[0]?.n || 0,
      newAccounts: newAccounts.rows[0]?.n || 0,
      active: active.rows[0]?.n || 0,
      messages: {
        authed: messages.rows[0]?.authed || 0,
        guest: messages.rows[0]?.guest || 0,
      },
      conversations: conversations.rows[0]?.n || 0,
      thumbs: thumbSummary,
      newActivated: {
        n: activated.rows[0]?.n || 0,
        verifiedN: activated.rows[0]?.verified_n || 0,
        estimatedN: activated.rows[0]?.estimated_n || 0,
      },
      daily: daily.rows,
      signups: signups.rows,
      modes: modes.rows,
    }
  } catch (error) {
    if (schemaUnavailable(error)) {
      return {
        ...emptyInsights({ available: false, schemaReady: false }),
        registered: 0,
        newAccounts: 0,
        active: 0,
        messages: { authed: 0, guest: 0 },
        conversations: 0,
        daily: [],
        signups: [],
      }
    }
    throw error
  }
}

async function loadConversations({ from, to }, env = process.env) {
  const exclude = parseExcludeEmails(env)
  const params = [exclude, from, to]
  try {
    const daily = await db.query(
      `SELECT
         (e.created_at AT TIME ZONE 'UTC')::date::text AS day,
         COUNT(*) FILTER (WHERE e.name = 'message_sent' AND e.is_guest = FALSE)::int AS authed_messages,
         COUNT(*) FILTER (WHERE e.name = 'message_sent' AND e.is_guest = TRUE)::int AS guest_messages,
         COUNT(*) FILTER (WHERE e.name = 'conversation_started')::int AS conversations
       FROM product_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.name IN ('message_sent', 'conversation_started')
         AND (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (e.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY 1
       ORDER BY 1`,
      params,
    )
    const modes = await db.query(
      `SELECT COALESCE(e.mode_id, 'unknown') AS mode_id, e.is_guest, COUNT(*)::int AS n
       FROM product_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.name = 'message_sent'
         AND (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (e.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY 1, 2
       ORDER BY n DESC`,
      params,
    )
    const started = daily.rows.reduce((sum, row) => sum + Number(row.conversations || 0), 0)
    const authedMessages = daily.rows.reduce((sum, row) => sum + Number(row.authed_messages || 0), 0)
    const guestMessages = daily.rows.reduce((sum, row) => sum + Number(row.guest_messages || 0), 0)
    let sessionAvg = { n: 0, avgMessages: null, avgMinutes: null, note: 'session_end_only' }
    try {
      const sessions = await db.query(
        `SELECT COUNT(*)::int AS n,
                AVG(ss.message_count)::float AS avg_messages,
                AVG(ss.session_length_minutes)::float AS avg_minutes
         FROM session_signals ss
         JOIN users u ON u.id = ss.user_id
         WHERE ${excludeSql('u')}
           AND (ss.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date`,
        params,
      )
      sessionAvg = {
        n: sessions.rows[0]?.n || 0,
        avgMessages: sessions.rows[0]?.avg_messages != null ? Math.round(sessions.rows[0].avg_messages * 10) / 10 : null,
        avgMinutes: sessions.rows[0]?.avg_minutes != null ? Math.round(sessions.rows[0].avg_minutes * 10) / 10 : null,
        note: 'Includes only authed sessions that fired session-end. Incomplete coverage.',
      }
    } catch (error) {
      if (!schemaUnavailable(error)) throw error
    }
    let guestSessions = { n: 0, avgMessages: null }
    try {
      const guest = await db.query(
        `SELECT COUNT(*)::int AS n, AVG(message_count)::float AS avg_messages
         FROM anonymous_sessions
         WHERE (created_at AT TIME ZONE 'UTC')::date BETWEEN $1::date AND $2::date`,
        [from, to],
      )
      guestSessions = {
        n: guest.rows[0]?.n || 0,
        avgMessages: guest.rows[0]?.avg_messages != null ? Math.round(guest.rows[0].avg_messages * 10) / 10 : null,
      }
    } catch (error) {
      if (!schemaUnavailable(error)) throw error
    }
    return {
      available: true,
      daily: daily.rows,
      modes: modes.rows,
      totals: {
        authedMessages,
        guestMessages,
        conversations: started,
        avgMessagesPerStarted: started ? Math.round((authedMessages / started) * 10) / 10 : null,
      },
      sessionEnd: sessionAvg,
      guestSessions,
    }
  } catch (error) {
    if (schemaUnavailable(error)) return { available: false, daily: [], modes: [], totals: {} }
    throw error
  }
}

async function loadFeedback({ from, to }, env = process.env) {
  const exclude = parseExcludeEmails(env)
  const params = [exclude, from, to]
  try {
    const outcomes = await db.query(
      `SELECT dimension, response, COUNT(*)::int AS n
       FROM product_feedback pf
       LEFT JOIN users u ON u.id = pf.user_id
       WHERE pf.dimension IN ('relief', 'clarity')
         AND (pf.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (pf.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY dimension, response`,
      params,
    )
    const survey = await db.query(
      `SELECT e.name, e.dimension, COUNT(*)::int AS n
       FROM product_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.name IN ('survey_shown', 'survey_skipped')
         AND (e.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (e.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY e.name, e.dimension`,
      params,
    )
    const thumbs = await db.query(
      `SELECT rating, reason, COUNT(*)::int AS n
       FROM message_feedback mf
       LEFT JOIN users u ON u.id = mf.user_id
       WHERE (mf.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (mf.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY rating, reason`,
      params,
    )
    const daily = await db.query(
      `SELECT (mf.created_at AT TIME ZONE 'UTC')::date::text AS day,
              COUNT(*) FILTER (WHERE mf.rating = 'up')::int AS up,
              COUNT(*) FILTER (WHERE mf.rating = 'down')::int AS down
       FROM message_feedback mf
       LEFT JOIN users u ON u.id = mf.user_id
       WHERE (mf.created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
         AND (mf.user_id IS NULL OR ${excludeSql('u')})
       GROUP BY 1
       ORDER BY 1`,
      params,
    )
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
      available: true,
      relief: summarizeOutcome('relief', outcomes.rows, survey.rows),
      clarity: summarizeOutcome('clarity', outcomes.rows, survey.rows),
      thumbs: thumbSummary,
      daily: daily.rows,
    }
  } catch (error) {
    if (schemaUnavailable(error)) {
      return {
        available: false,
        relief: { shown: 0, skipped: 0, answered: 0, options: {} },
        clarity: { shown: 0, skipped: 0, answered: 0, options: {} },
        thumbs: { up: 0, down: 0, total: 0, reasons: {} },
        daily: [],
      }
    }
    throw error
  }
}

async function loadRetention(env = process.env) {
  const exclude = parseExcludeEmails(env)
  const verifiedFrom = analyticsVerifiedFrom(env)
  try {
    const d1 = await retentionRow(exclude, verifiedFrom, 1)
    const d7 = await retentionRow(exclude, verifiedFrom, 7)
    const returning = await db.query(
      `SELECT COUNT(*)::int AS n
       FROM (
         SELECT e.user_id
         FROM product_events e
         JOIN users u ON u.id = e.user_id
         WHERE e.name = 'message_sent'
           AND ${excludeSql('u')}
         GROUP BY e.user_id
         HAVING COUNT(DISTINCT (e.created_at AT TIME ZONE 'UTC')::date) >= 2
       ) r`,
      [exclude],
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
    const cohorts = await db.query(
      `SELECT (u.first_activated_at AT TIME ZONE 'UTC')::date::text AS day, COUNT(*)::int AS n
       FROM users u
       WHERE u.first_activated_at IS NOT NULL
         AND ${excludeSql('u')}
         AND (u.first_activated_at AT TIME ZONE 'UTC')::date >= $2::date
       GROUP BY 1
       ORDER BY 1`,
      [exclude, verifiedFrom],
    )
    return {
      available: true,
      timezone: 'UTC',
      verifiedFrom,
      d1,
      d7,
      returningUsers: returning.rows[0]?.n || 0,
      newActivated: {
        n: activated.rows[0]?.n || 0,
        verifiedN: activated.rows[0]?.verified_n || 0,
        estimatedN: activated.rows[0]?.estimated_n || 0,
      },
      verifiedCohorts: cohorts.rows,
    }
  } catch (error) {
    if (schemaUnavailable(error)) {
      return { available: false, d1: { kind: 'empty', n: 0, d: 0 }, d7: { kind: 'empty', n: 0, d: 0 } }
    }
    throw error
  }
}

async function listUsers({ q = '', page = 1, limit = 25 }, env = process.env) {
  const exclude = parseExcludeEmails(env)
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 50)
  const safePage = Math.max(Number(page) || 1, 1)
  const offset = (safePage - 1) * safeLimit
  const query = String(q || '').trim().slice(0, 120)
  const params = [exclude]
  let filter = `WHERE ${excludeSql('u')}`
  if (query) {
    params.push(`%${query.toLowerCase()}%`)
    params.push(query)
    filter += ` AND (LOWER(u.email) LIKE $2 OR u.id::text = $3)`
  }
  const countSql = `SELECT COUNT(*)::int AS n FROM users u ${filter}`
  const listSql = `
    SELECT u.id, u.email, u.created_at, u.first_activated_at,
           COALESCE(u.memory_enabled, TRUE) AS memory_enabled,
           COALESCE(u.personalisation_enabled, TRUE) AS personalisation_enabled,
           stats.last_active_at,
           COALESCE(stats.messages, 0)::int AS messages,
           COALESCE(stats.conversations, 0)::int AS conversations
    FROM users u
    LEFT JOIN (
      SELECT e.user_id,
             MAX(e.created_at) FILTER (WHERE e.name = 'message_sent') AS last_active_at,
             COUNT(*) FILTER (WHERE e.name = 'message_sent') AS messages,
             COUNT(*) FILTER (WHERE e.name = 'conversation_started') AS conversations
      FROM product_events e
      WHERE e.user_id IS NOT NULL
      GROUP BY e.user_id
    ) stats ON stats.user_id = u.id
    ${filter}
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT ${safeLimit} OFFSET ${offset}
  `
  try {
    const count = await db.query(countSql, params)
    const rows = await db.query(listSql, params)
    return {
      available: true,
      page: safePage,
      limit: safeLimit,
      total: count.rows[0]?.n || 0,
      users: rows.rows.map(pickUserRow),
    }
  } catch (error) {
    if (schemaUnavailable(error)) {
      return { available: false, page: safePage, limit: safeLimit, total: 0, users: [] }
    }
    throw error
  }
}

async function getUserUsage(userId, env = process.env) {
  const exclude = parseExcludeEmails(env)
  try {
    const user = await db.query(
      `SELECT u.id, u.email, u.created_at, u.first_activated_at,
              COALESCE(u.memory_enabled, TRUE) AS memory_enabled,
              COALESCE(u.personalisation_enabled, TRUE) AS personalisation_enabled
       FROM users u
       WHERE u.id = $2 AND ${excludeSql('u')}`,
      [exclude, userId],
    )
    if (!user.rows[0]) return { available: true, user: null }
    const stats = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE name = 'message_sent')::int AS messages,
         COUNT(*) FILTER (WHERE name = 'conversation_started')::int AS conversations,
         MAX(created_at) FILTER (WHERE name = 'message_sent') AS last_active_at
       FROM product_events
       WHERE user_id = $1`,
      [userId],
    )
    const modes = await db.query(
      `SELECT COALESCE(mode_id, 'unknown') AS mode_id, COUNT(*)::int AS n
       FROM product_events
       WHERE user_id = $1 AND name = 'message_sent'
       GROUP BY 1
       ORDER BY n DESC`,
      [userId],
    )
    const daily = await db.query(
      `SELECT (created_at AT TIME ZONE 'UTC')::date::text AS day, COUNT(*)::int AS n
       FROM product_events
       WHERE user_id = $1 AND name = 'message_sent'
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 90`,
      [userId],
    )
    const thumbs = await db.query(
      `SELECT rating, COUNT(*)::int AS n
       FROM message_feedback
       WHERE user_id = $1
       GROUP BY rating`,
      [userId],
    )
    const surveys = await db.query(
      `SELECT name, COUNT(*)::int AS n
       FROM product_events
       WHERE user_id = $1 AND name IN ('survey_shown', 'survey_skipped')
       GROUP BY name`,
      [userId],
    )
    const thumbSummary = { up: 0, down: 0 }
    for (const row of thumbs.rows) {
      if (row.rating === 'up' || row.rating === 'down') thumbSummary[row.rating] = row.n
    }
    const surveySummary = { shown: 0, skipped: 0 }
    for (const row of surveys.rows) {
      if (row.name === 'survey_shown') surveySummary.shown = row.n
      if (row.name === 'survey_skipped') surveySummary.skipped = row.n
    }
    return {
      available: true,
      user: pickUserRow({
        ...user.rows[0],
        last_active_at: stats.rows[0]?.last_active_at || null,
        messages: stats.rows[0]?.messages || 0,
        conversations: stats.rows[0]?.conversations || 0,
      }),
      modes: modes.rows,
      daily: daily.rows.reverse(),
      thumbs: thumbSummary,
      surveys: surveySummary,
    }
  } catch (error) {
    if (schemaUnavailable(error)) return { available: false, user: null }
    throw error
  }
}

async function loadOps(env = process.env) {
  const verifiedFrom = analyticsVerifiedFrom(env)
  let eventsReady = false
  let eventCount = 0
  try {
    const count = await db.query(`SELECT COUNT(*)::int AS n FROM product_events`)
    eventsReady = true
    eventCount = count.rows[0]?.n || 0
  } catch (error) {
    if (!schemaUnavailable(error)) throw error
  }
  return {
    timezone: 'UTC',
    verifiedFrom,
    autoDeletionImplemented: false,
    analyticsRetentionNote:
      'Product events are intended to be kept for 24 months. Automatic deletion is not implemented yet.',
    productEventsReady: eventsReady,
    productEventCount: eventCount,
    testAccountsExcluded: true,
    hiddenThink: String(env.PARLE_HIDDEN_THINK || '').toLowerCase() === 'on',
    configuredModel: env.OPENAI_MODEL || null,
    adminAllowlistConfigured: Boolean(String(env.ADMIN_EMAILS || '').trim()),
  }
}

function loadAiStatus(env = process.env) {
  return {
    configuredModel: env.OPENAI_MODEL || null,
    latency: { status: 'not_recorded', note: 'Think-ms is a response header only and is not stored.' },
    errors: { status: 'not_recorded', note: 'HTTP 5xx and 429s are not persisted. Rate limits are in-memory.' },
    cost: { status: 'not_recorded', note: 'Token usage and spend are not logged.' },
    hiddenThink: String(env.PARLE_HIDDEN_THINK || '').toLowerCase() === 'on',
  }
}

module.exports = {
  USER_LIST_FIELDS,
  pickUserRow,
  parseAdminRange,
  loadOverview,
  loadConversations,
  loadFeedback,
  loadRetention,
  listUsers,
  getUserUsage,
  loadOps,
  loadAiStatus,
  pct,
}
