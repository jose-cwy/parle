/**
 * Rehearsal-only fixture for D.3 Playwright: dedicated wrap account.
 * Does not wrap testuser_a mixed V2 conversations.
 */
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { CURRENT_REHEARSAL_BRANCH } = require('./rehearsalEnv')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../lib/db')
const { insertChatMessage } = require('../lib/chatMemoryDb')
const { wrapUserLegacyTimeline } = require('../lib/parle/legacyWrapCopy')

const EMAIL = 'testuser_legacy@parle.test'
const PASSWORD = 'TestPassword123!'
const MARKER = 'v2d3-hist-marker'
const COUNT = 55

async function main() {
  const ident = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id
  `)
  if (ident.rows[0]?.branch_id !== CURRENT_REHEARSAL_BRANCH) {
    throw new Error('refusing seed off rehearsal branch')
  }
  const hash = await bcrypt.hash(PASSWORD, 10)
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [EMAIL])
  let userId = existing.rows[0]?.id
  if (!userId) {
    const inserted = await db.query(
      `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
       VALUES ($1, $2, 'legacy-fixture', FALSE, FALSE, FALSE, now())
       RETURNING id`,
      [EMAIL, hash],
    )
    userId = inserted.rows[0].id
  } else {
    await db.query('UPDATE users SET password = $1, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2', [
      hash,
      userId,
    ])
  }

  const have = await db.query('SELECT COUNT(*)::int AS n FROM chat_memory WHERE user_id = $1', [userId])
  if (have.rows[0].n < COUNT) {
    const start = have.rows[0].n
    for (let i = start; i < COUNT; i += 1) {
      await insertChatMessage(
        userId,
        i % 2 === 0 ? 'user' : 'assistant',
        i === 0 ? `${MARKER}-first` : i === COUNT - 1 ? `${MARKER}-last` : `${MARKER}-${i}`,
        new Date(Date.UTC(2024, 2, 1, 0, 0, i)),
      )
    }
  }
  const result = await wrapUserLegacyTimeline(userId, { writesQuiesced: true, batchSize: 40 })
  process.stdout.write(
    JSON.stringify({
      email: EMAIL,
      mappedCount: result.mappedCount,
      state: result.state,
      wrapCount: result.wrapCount,
    }),
  )
}

main()
  .catch((error) => {
    console.error(String(error.message || error).slice(0, 200))
    process.exitCode = 1
  })
  .finally(() => db.pool.end())
