#!/usr/bin/env node
/**
 * Synthetic feature checks against process.env.DATABASE_URL, which the parent
 * sets to REHEARSAL_DATABASE_URL. Refuses the primary branch.
 */
const bcrypt = require('bcryptjs')
const db = require('../lib/db')
const { encrypt, decrypt, PREFIX } = require('../lib/security/encryption')
const { insertChatMessage, listChatMessages } = require('../lib/chatMemoryDb')
const { createJournalEntry, listJournalEntries, deleteJournalEntry } = require('../lib/journalDb')
const { saveLivingProfile, getLivingProfileForUser } = require('../lib/parle/livingProfile')
const { emptyProfile, bumpFact } = require('../lib/parle/livingProfileCore')
const { updateProfileAfterSession, getUserChatSettings } = require('../lib/parle/preferences')
const { insertMessageFeedback, insertProductFeedback } = require('../lib/parle/feedbackDb')
const { checkAndIncrementDailyUsage, hashIP, GUEST_LIMIT_WINDOW_MS } = require('../lib/usageTracking')
const { saveGuestEmailCapture } = require('../lib/parle/guestEmailsDb')
const { PRIMARY_BRANCH_ID, EXPECTED_PROJECT_ID } = require('./rehearsalEnv')

const results = []

function pass(name) {
  results.push({ name, ok: true })
  console.log('PASS', name)
}

function fail(name, error) {
  results.push({ name, ok: false, error: String(error.message || error).slice(0, 200) })
  console.log('FAIL', name, String(error.message || error).slice(0, 200))
}

async function assert(name, fn) {
  try {
    await fn()
    pass(name)
  } catch (error) {
    fail(name, error)
  }
}

async function main() {
  const ident = await db.query(`
    select current_setting('neon.project_id', true) as project_id,
           current_setting('neon.branch_id', true) as branch_id
  `)
  const row = ident.rows[0]
  console.log(JSON.stringify({ project_id: row.project_id, branch_id: row.branch_id }))
  if (!row.branch_id || !row.project_id) throw new Error('Could not confirm branch identity')
  if (row.project_id !== EXPECTED_PROJECT_ID) throw new Error('Unexpected project')
  if (row.branch_id === PRIMARY_BRANCH_ID) throw new Error('Refusing app-flow writes on primary')
  if (row.branch_id !== 'br-misty-recipe-apcj8oyo') {
    throw new Error(`Unexpected rehearsal branch ${row.branch_id}`)
  }

  const stamp = Date.now()
  const email = `rehearse-flow-${stamp}@parle.test`
  const guestEmail = `rehearse-guest-${stamp}@parle.test`
  const password = 'rehearse-flow-pass'
  const hash = await bcrypt.hash(password, 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, memory_enabled, personalisation_enabled)
     VALUES ($1, $2, TRUE, TRUE) RETURNING id`,
    [email, hash],
  )
  const userId = inserted.rows[0].id
  const guestToken = `rehearse-${stamp}`
  const guestIp = `203.0.113.${stamp % 200}`
  const guestUsageId = `${hashIP(guestIp)}:${Math.floor(Date.now() / GUEST_LIMIT_WINDOW_MS)}`

  try {
    await assert('auth_password_roundtrip', async () => {
      const found = await db.query('SELECT id, password FROM users WHERE email = $1', [email])
      if (!found.rows[0] || found.rows[0].id !== userId) throw new Error('user not found')
      const ok = await bcrypt.compare(password, found.rows[0].password)
      if (!ok) throw new Error('bcrypt mismatch')
    })

    await assert('letters_to_self_select_still_works', async () => {
      await db.query('SELECT content, is_completed FROM letters_to_self WHERE user_id = $1', [userId])
    })

    await assert('chat_persist_and_history', async () => {
      await insertChatMessage(userId, 'user', 'synthetic rehearsal chat line')
      await insertChatMessage(userId, 'assistant', 'synthetic rehearsal reply')
      const history = await listChatMessages(userId)
      if (history.length < 2) throw new Error(`history ${history.length}`)
      if (history.some((m) => m.text.includes('synthetic rehearsal') === false && history.length)) {
        /* mixed */
      }
      if (!history.find((m) => m.text === 'synthetic rehearsal chat line')) {
        throw new Error('decrypted history missing user line')
      }
    })

    await assert('journal_encrypt_list', async () => {
      const dateKey = '2026-10-20'
      const created = await createJournalEntry(userId, 'synthetic journal for rehearsal', dateKey)
      if (created.content !== 'synthetic journal for rehearsal') throw new Error('journal decrypt mismatch')
      const listed = await listJournalEntries(userId)
      if (!listed.some((e) => e.content === 'synthetic journal for rehearsal')) {
        throw new Error('journal list miss')
      }
      await deleteJournalEntry(created.id, userId)
    })

    await assert('living_profile_and_preferences', async () => {
      let profile = emptyProfile()
      profile = bumpFact(profile, {
        category: 'situation',
        key: 'people:synthetic',
        text: 'synthetic-name',
        confidence: 0.5,
      })
      await saveLivingProfile(userId, profile)
      const loaded = await getLivingProfileForUser(userId, { personalisationEnabled: true })
      if (!loaded) throw new Error('living profile missing')
      await updateProfileAfterSession(userId, {
        userAvgMessageLength: 12,
        startingMode: 'Just listen',
        finalMode: 'Just listen',
        modeSwitches: 0,
        repeatSentimentDetected: false,
        sessionLengthMinutes: 3,
      })
      const settings = await getUserChatSettings(userId)
      if (!settings) throw new Error('settings missing')
    })

    await assert('quotes_favorites', async () => {
      await db.query(
        'INSERT INTO quote_favorites (user_id, quote_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, 1],
      )
      const rows = await db.query('SELECT quote_id FROM quote_favorites WHERE user_id = $1', [userId])
      if (!rows.rows.some((r) => Number(r.quote_id) === 1)) throw new Error('favorite missing')
    })

    await assert('feedback_writes', async () => {
      await insertMessageFeedback({
        userId,
        sessionId: `rehearse-${stamp}`,
        messageId: 'm1',
        rating: 'up',
        reason: null,
        modeId: 'listen',
        isGuest: false,
      })
      await insertProductFeedback({
        userId,
        sessionId: `rehearse-${stamp}`,
        variant: 'a',
        response: 'helpful',
        note: null,
        messageCount: 2,
        isGuest: false,
      })
    })

    await assert('guest_usage_limit', async () => {
      const first = await checkAndIncrementDailyUsage({
        userId: null,
        ip: guestIp,
        isGuest: true,
      })
      if (!first.allowed) throw new Error('first guest increment blocked')
      if (first.used < 1) throw new Error('usage not incremented')
    })

    await assert('guest_email_and_anonymous_session', async () => {
      const saved = await saveGuestEmailCapture({
        email: guestEmail,
        reason: 'limit',
        sessionMessageCount: 1,
        source: 'guest_chat',
      })
      if (!saved.ok) throw new Error('guest email save failed')
      await db.query(
        `INSERT INTO anonymous_sessions (session_token, mode_used, message_count)
         VALUES ($1, $2, 1)
         ON CONFLICT DO NOTHING`,
        [guestToken, 'Just listen'],
      )
    })

    await assert('deprecated_memory_and_gamification', async () => {
      await db.query(
        `INSERT INTO user_memory (user_id, memory, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (user_id) DO UPDATE SET memory = EXCLUDED.memory, updated_at = now()`,
        [userId, JSON.stringify({ rehearsal: true })],
      )
      const mem = await db.query('SELECT memory FROM user_memory WHERE user_id = $1', [userId])
      if (!mem.rows[0] || mem.rows[0].memory.rehearsal !== true) throw new Error('memory mismatch')
      await db.query('DELETE FROM user_memory WHERE user_id = $1', [userId])
      await db.query(
        `INSERT INTO gamification (user_id, streaks, entries_count, quotes_read, chat_interactions)
         VALUES ($1, 1, 1, 1, 1)
         ON CONFLICT (user_id) DO UPDATE SET streaks = 1`,
        [userId],
      )
    })

    await assert('session_signals', async () => {
      await db.query(
        `INSERT INTO session_signals (
           session_id, user_id, message_count, user_avg_message_length, session_length_minutes
         ) VALUES (gen_random_uuid(), $1, 2, 12, 3)`,
        [userId],
      )
    })

    await assert('recovery_decrypt_after_reconnect', async () => {
      const plain = 'synthetic recovery payload'
      const stored = encrypt(plain)
      if (!String(stored).startsWith(PREFIX)) throw new Error('missing prefix')
      await db.query('UPDATE users SET last_session_summary = $1 WHERE id = $2', [stored, userId])
      await db.query('SELECT 1')
      const read = await db.query('SELECT last_session_summary FROM users WHERE id = $1', [userId])
      const back = decrypt(read.rows[0].last_session_summary)
      if (back !== plain) throw new Error('recovery decrypt mismatch')
    })

    await assert('archived_tables_not_in_public', async () => {
      const publicLegacy = await db.query(`
        select table_name from information_schema.tables
        where table_schema='public' and table_name = ANY($1)
      `, [[
        'chat_messages', 'diary_entries', 'future_letters', 'guest_exit_feedback',
        'journey_progress', 'profiles', 'session_feedback', 'sessions',
        'auth_tokens', 'deep_feedback',
      ]])
      if (publicLegacy.rows.length) {
        throw new Error(`still public: ${publicLegacy.rows.map((r) => r.table_name).join(',')}`)
      }
      const archived = await db.query(`
        select table_name from information_schema.tables
        where table_schema='archive_legacy' and table_name = 'sessions'
      `)
      if (!archived.rows.length) throw new Error('sessions not in archive_legacy')
    })
  } finally {
    await db.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => {})
    await db.query('DELETE FROM guest_emails WHERE LOWER(email) = LOWER($1)', [guestEmail]).catch(() => {})
    await db.query('DELETE FROM anonymous_sessions WHERE session_token = $1', [guestToken]).catch(() => {})
    await db.query('DELETE FROM usage_tracking WHERE user_identifier = $1', [guestUsageId]).catch(() => {})
    const leftover = await db.query(
      `SELECT count(*)::int AS n FROM users WHERE email LIKE 'rehearse-flow-%@parle.test'`,
    )
    console.log('SYNTH_LEFT', leftover.rows[0].n)
  }

  const failed = results.filter((r) => !r.ok)
  console.log(JSON.stringify({ passed: results.filter((r) => r.ok).length, failed: failed.length, failures: failed }))
  if (failed.length) process.exit(1)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
