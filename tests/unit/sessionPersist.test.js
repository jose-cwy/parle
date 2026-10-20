const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()

const db = require('../../lib/db')
const { encrypt, decrypt } = require('../../lib/security/encryption')
const {
  ensurePreferenceProfileSchema,
  updateProfileAfterSession,
  getUserChatSettings,
} = require('../../lib/parle/preferences')
const {
  saveLivingProfile,
  getLivingProfileForUser,
} = require('../../lib/parle/livingProfile')
const { emptyProfile, bumpFact } = require('../../lib/parle/livingProfileCore')

const SYNTH_EMAIL = `phase1-synth-${Date.now()}@parle.test`

async function tableExists(name) {
  const result = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    [name],
  )
  return result.rows.length > 0
}

test('personalization schema, save, and reload with synthetic data', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is not set')
    return
  }

  const ident = await db.query(`SELECT current_setting('neon.branch_id', true) AS branch_id`)
  if (ident.rows[0]?.branch_id === 'br-morning-sun-apghun9g') {
    t.skip('refusing persistence writes on the primary branch; use scripts/run-rehearsal-db-tests.js')
    return
  }

  const beforeUsers = await db.query('SELECT count(*)::int AS n FROM users')
  const beforeMemory = await db.query('SELECT count(*)::int AS n FROM chat_memory')
  const beforeLiving = await db.query('SELECT count(*)::int AS n FROM user_living_profile')

  let userId = null
  try {
    const missingBefore = !(await tableExists('session_length_history'))
    if (missingBefore) {
      await assert.rejects(
        () =>
          db.query(
            `INSERT INTO session_length_history (user_id, user_avg_message_length)
             VALUES ('00000000-0000-0000-0000-000000000000', 1)`,
          ),
        (error) => error && error.code === '42P01',
      )
    }

    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS image_attach_consent_at TIMESTAMPTZ')
    await ensurePreferenceProfileSchema()
    assert.equal(await tableExists('session_length_history'), true)

    const password = await bcrypt.hash('phase1-synth-pass', 4)
    const inserted = await db.query(
      `INSERT INTO users (email, password, memory_enabled, personalisation_enabled, created_at, updated_at)
       VALUES ($1, $2, TRUE, TRUE, now(), now())
       RETURNING id`,
      [SYNTH_EMAIL, password],
    )
    userId = inserted.rows[0].id

    await updateProfileAfterSession(userId, {
      message_count: 4,
      user_avg_message_length: 90,
      avg_reply_gap_seconds: 12,
      mode_switches: 1,
      starting_mode: 'Emotional support',
      final_mode: 'Emotional support',
      repeat_sentiment_detected: false,
    })

    const history = await db.query(
      'SELECT starting_mode, final_mode FROM session_length_history WHERE user_id = $1',
      [userId],
    )
    assert.equal(history.rows.length, 1)
    assert.equal(history.rows[0].final_mode, 'Emotional support')

    const factArgs = {
      category: 'situation',
      key: 'person:jia hui',
      text: 'Someone you talk about as Jia Hui.',
      confidence: 0.4,
    }
    await saveLivingProfile(userId, bumpFact(bumpFact(emptyProfile(), factArgs), factArgs))

    const summaryPlain = 'Jia Hui went quiet after the argument. The user felt left behind.'
    await db.query('UPDATE users SET last_session_summary = $1 WHERE id = $2', [
      encrypt(summaryPlain),
      userId,
    ])

    const settings = await getUserChatSettings(userId)
    assert.equal(settings.memory_enabled, true)
    assert.equal(settings.personalisation_enabled, true)
    assert.equal(settings.has_last_session_summary, true)
    assert.equal(settings.last_session_summary, summaryPlain)

    const living = await getLivingProfileForUser(userId, { personalisationEnabled: true })
    assert.ok(living)
    assert.equal(
      (living.facts || []).some((fact) => fact.key === 'person:jia hui'),
      true,
    )
    assert.equal(decrypt(encrypt('roundtrip')), 'roundtrip')
  } finally {
    if (userId) {
      await db.query('DELETE FROM users WHERE id = $1', [userId])
    }
    const afterUsers = await db.query('SELECT count(*)::int AS n FROM users')
    const afterMemory = await db.query('SELECT count(*)::int AS n FROM chat_memory')
    const afterLiving = await db.query('SELECT count(*)::int AS n FROM user_living_profile')
    assert.equal(afterUsers.rows[0].n, beforeUsers.rows[0].n)
    assert.equal(afterMemory.rows[0].n, beforeMemory.rows[0].n)
    assert.equal(afterLiving.rows[0].n, beforeLiving.rows[0].n)
    await db.pool.end().catch(() => {})
  }
})
