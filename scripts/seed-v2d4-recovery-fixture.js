/**
 * Rehearsal-only D.4 fixture. Does not wrap genuine testuser_a mixed chats.
 */
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { CURRENT_REHEARSAL_BRANCH } = require('./rehearsalEnv')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../lib/db')
const { encrypt } = require('../lib/security/encryption')
const { insertChatMessage } = require('../lib/chatMemoryDb')
const { wrapUserLegacyTimeline } = require('../lib/parle/legacyWrapCopy')
const { createConversation, archiveConversation } = require('../lib/parle/conversations')

const EMAIL = 'testuser_d4@parle.test'
const PASSWORD = 'TestPassword123!'
const MARKER_LEGACY = 'd4-legacy-first'
const MARKER_LIVE = 'd4-v2-live'

async function ensureUser(email, name) {
  const hash = await bcrypt.hash(PASSWORD, 10)
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows[0]?.id) {
    await db.query('UPDATE users SET password = $1, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2', [
      hash,
      existing.rows[0].id,
    ])
    return existing.rows[0].id
  }
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [email, hash, name],
  )
  return inserted.rows[0].id
}

async function main() {
  const ident = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== CURRENT_REHEARSAL_BRANCH) {
    throw new Error('refusing seed off rehearsal branch')
  }
  const userId = await ensureUser(EMAIL, 'd4-recovery')
  await ensureUser('testuser_d4_b@parle.test', 'd4-stranger')

  const have = await db.query('SELECT COUNT(*)::int AS n FROM chat_memory WHERE user_id = $1', [userId])
  if (have.rows[0].n < 8) {
    for (let i = have.rows[0].n; i < 8; i += 1) {
      await insertChatMessage(
        userId,
        i % 2 === 0 ? 'user' : 'assistant',
        i === 0 ? MARKER_LEGACY : `d4-hist-${i}`,
        new Date(Date.UTC(2024, 5, 1, 0, 0, i)),
      )
    }
  }
  const wrap = await wrapUserLegacyTimeline(userId, { writesQuiesced: true, batchSize: 40 })

  const existingLive = await db.query(
    `SELECT c.id
     FROM conversations c
     JOIN conversation_messages m ON m.conversation_id = c.id
     WHERE c.user_id = $1 AND c.origin = 'live' AND m.role = 'user'
     LIMIT 1`,
    [userId],
  )
  let liveId = existingLive.rows[0]?.id
  if (!liveId) {
    const live = await createConversation(userId)
    liveId = live.id
    await db.query(
      `INSERT INTO conversation_messages (conversation_id, user_id, role, seq, text_enc, created_at)
       VALUES ($1, $2, 'user', 1, $3, now()), ($1, $2, 'assistant', 2, $4, now())`,
      [liveId, userId, encrypt(MARKER_LIVE), encrypt('d4-v2-live-reply')],
    )
  }
  const archivedHave = await db.query(
    `SELECT id FROM conversations WHERE user_id = $1 AND origin = 'live' AND status = 'archived' LIMIT 1`,
    [userId],
  )
  if (!archivedHave.rows[0]) {
    const archived = await createConversation(userId)
    await db.query(
      `INSERT INTO conversation_messages (conversation_id, user_id, role, seq, text_enc, created_at)
       VALUES ($1, $2, 'user', 1, $3, now())`,
      [archived.id, userId, encrypt('d4-v2-archived')],
    )
    await archiveConversation(userId, archived.id)
  }
  await db.query(
    `INSERT INTO conversation_requests (user_id, conversation_id, idempotency_key, status, error_code)
     VALUES ($1, $2, $3, 'failed', 'provider_error')
     ON CONFLICT DO NOTHING`,
    [userId, liveId, 'd4-recovery-failed-stream'],
  )

  process.stdout.write(
    JSON.stringify({
      email: EMAIL,
      wrapState: wrap.state,
      mappedCount: wrap.mappedCount,
      liveId: Boolean(liveId),
    }),
  )
}

main()
  .catch((error) => {
    console.error(String(error.message || error).slice(0, 200))
    process.exitCode = 1
  })
  .finally(() => db.pool.end())
