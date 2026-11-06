/**
 * Rehearsal-only D.5 access accounts. Does not wrap genuine testuser_a.
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

const PASSWORD = 'TestPassword123!'

async function ensureUser(email, name) {
  const hash = await bcrypt.hash(PASSWORD, 10)
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows[0]?.id) {
    await db.query(
      'UPDATE users SET password = $1, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $2',
      [hash, existing.rows[0].id],
    )
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

async function ensureMemory(userId, count, prefix) {
  const have = await db.query('SELECT COUNT(*)::int AS n FROM chat_memory WHERE user_id = $1', [userId])
  for (let i = have.rows[0].n; i < count; i += 1) {
    await insertChatMessage(
      userId,
      i % 2 === 0 ? 'user' : 'assistant',
      i === 0 ? `${prefix}-first` : `${prefix}-${i}`,
      new Date(Date.UTC(2024, 6, 1, 0, 0, i)),
    )
  }
}

async function main() {
  const ident = await db.query(`SELECT current_setting('neon.branch_id', true) AS branch_id`)
  if (ident.rows[0]?.branch_id !== CURRENT_REHEARSAL_BRANCH) {
    throw new Error('refusing seed off rehearsal branch')
  }
  const legacyOnly = await ensureUser('testuser_d5_legacyonly@parle.test', 'd5-legacyonly')
  const incomplete = await ensureUser('testuser_d5_incomplete@parle.test', 'd5-incomplete')
  await ensureMemory(legacyOnly, 6, 'd5-only')
  await ensureMemory(incomplete, 8, 'd5-inc')
  const wrap = await wrapUserLegacyTimeline(incomplete, {
    writesQuiesced: false,
    batchSize: 3,
    maxBatches: 1,
  })
  process.stdout.write(
    JSON.stringify({
      legacyOnly: true,
      incompleteState: wrap.state,
      incompleteUnmapped: wrap.unmappedCount,
    }),
  )
}

main()
  .catch((error) => {
    console.error(String(error.message || error).slice(0, 200))
    process.exitCode = 1
  })
  .finally(() => db.pool.end())
